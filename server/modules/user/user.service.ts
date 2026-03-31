import bcrypt from "bcrypt";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import type { Status } from "@prisma/client";
import { notificationTrigger } from "../../services/notificationTrigger.service.js";
import { rbacService } from "../../services/rbac.service.js";

export const userService = {
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    roleId?: string;
    status?: Status;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: "insensitive" } },
        { fullName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ];
    }
    if (params.roleId) where.roleId = params.roleId;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          phone: true,
          status: true,
          allProperties: true,
          isSuperAdmin: true,
          role: { select: { id: true, name: true, level: true } },
          reportsTo: { select: { id: true, username: true, fullName: true } },
          department: { select: { id: true, name: true } },
          _count: { select: { propertyAssignments: true, subordinates: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Resolve inherited property counts for users who report to someone
    const enriched = await Promise.all(
      data.map(async (u: any) => {
        if (u.allProperties || u.isSuperAdmin) return u;
        if (u._count.propertyAssignments === 0 && u.reportsTo) {
          // Inherited — resolve from manager
          const propIds = await rbacService.getUserPropertyIds(u.id);
          return {
            ...u,
            _count: {
              ...u._count,
              propertyAssignments: propIds === "all" ? -1 : propIds.length,
            },
          };
        }
        return u;
      })
    );

    return {
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        department: true,
        reportsTo: { select: { id: true, username: true, fullName: true } },
        propertyAssignments: {
          include: {
            property: { select: { id: true, name: true, code: true } },
          },
        },
        subordinates: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: { select: { name: true } },
          },
        },
      },
    });
  },

  async create(data: {
    username: string;
    password: string;
    fullName?: string;
    email?: string;
    phone?: string;
    roleId: string;
    reportsToId?: string;
    allProperties?: boolean;
    propertyIds?: string[];
    departmentId?: string | null;
  }) {
    // Auto-inherit manager's properties if reportsTo is set
    let effectivePropertyIds = data.propertyIds ?? [];
    let effectiveAllProperties = data.allProperties ?? false;

    if (data.reportsToId) {
      // Note: circular chain on create is impossible since the user doesn't exist yet
      const managerProps = await this.getManagerPropertyIds(data.reportsToId);
      if (managerProps === "all") {
        // Manager has all properties — user can have allProperties or specific ones
        if (!effectivePropertyIds.length && !effectiveAllProperties) {
          effectiveAllProperties = true;
        }
      } else {
        // Manager has specific properties — subordinate inherits them if none specified
        effectiveAllProperties = false;
        if (effectivePropertyIds.length === 0) {
          effectivePropertyIds = managerProps;
        }
        // Validate subset
        await this.validatePropertyAccess(data.reportsToId, effectiveAllProperties, effectivePropertyIds);
      }
    }

    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);

    const { propertyIds, password, ...userData } = data;

    const user = await prisma.user.create({
      data: {
        ...userData,
        allProperties: effectiveAllProperties,
        passwordHash,
      },
      include: {
        role: true,
      },
    });

    // Must have at least one property
    if (!effectiveAllProperties && effectivePropertyIds.length === 0) {
      throw new Error("At least one property must be assigned to each user");
    }

    if (effectivePropertyIds.length > 0 && !effectiveAllProperties) {
      await prisma.userPropertyAssignment.createMany({
        data: effectivePropertyIds.map((propertyId) => ({
          userId: user.id,
          propertyId,
        })),
      });
    }

    // Fire-and-forget: notify manager about new team member (#16)
    notificationTrigger
      .onNewUserCreated(user.id, data.fullName || data.username, data.reportsToId)
      .catch(console.error);

    return this.findById(user.id);
  },

  async update(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phone?: string;
      roleId?: string;
      reportsToId?: string;
      allProperties?: boolean;
      propertyIds?: string[];
      departmentId?: string | null;
    }
  ) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User not found");
    if (existing.isSuperAdmin) throw new Error("Cannot modify super admin user");

    // Prevent circular reporting chain
    if (data.reportsToId) {
      await this.validateNoCircularChain(id, data.reportsToId);
    }

    // Validate property access against manager
    const managerId = data.reportsToId !== undefined ? data.reportsToId : existing.reportsToId;
    if (managerId) {
      await this.validatePropertyAccess(managerId, data.allProperties ?? existing.allProperties, data.propertyIds ?? []);
    }

    const { propertyIds, ...userData } = data;

    // Track changes for notification
    const changes: string[] = [];
    if (data.roleId && data.roleId !== existing.roleId) {
      const newRole = await prisma.role.findUnique({ where: { id: data.roleId }, select: { name: true } });
      if (newRole) changes.push(`role changed to ${newRole.name}`);
    }

    const user = await prisma.user.update({
      where: { id },
      data: userData,
    });

    if (propertyIds) {
      // Must have at least one property
      if (!data.allProperties && propertyIds.length === 0) {
        throw new Error("At least one property must be assigned to each user");
      }

      // Check if removing properties that subordinates depend on
      if (!data.allProperties) {
        await this.validatePropertyRemovalAgainstSubordinates(id, propertyIds);
      }

      await prisma.userPropertyAssignment.deleteMany({ where: { userId: id } });
      if (propertyIds.length > 0) {
        await prisma.userPropertyAssignment.createMany({
          data: propertyIds.map((propertyId) => ({
            userId: id,
            propertyId,
          })),
        });
      }
      changes.push("property assignments updated");
    }

    // Fire-and-forget notifications
    if (changes.length > 0) {
      notificationTrigger
        .onUserAccountChanged(id, `Your account was updated: ${changes.join(", ")}`)
        .catch(console.error);
    }

    // #11 Subordinate reassigned — notify new and previous managers
    if (data.reportsToId !== undefined && data.reportsToId !== existing.reportsToId) {
      const userName = existing.fullName || existing.username;
      if (data.reportsToId) {
        notificationTrigger
          .onNewSubordinate(id, userName, data.reportsToId, existing.reportsToId)
          .catch(console.error);
      }
    }

    return this.findById(id);
  },

  async validatePropertyRemovalAgainstSubordinates(userId: string, newPropertyIds: string[]) {
    const newSet = new Set(newPropertyIds);

    // Recursively collect all subordinate property IDs
    const collectSubPropertyIds = async (managerId: string): Promise<Set<string>> => {
      const subs = await prisma.user.findMany({
        where: { reportsToId: managerId },
        select: {
          id: true,
          fullName: true,
          allProperties: true,
          propertyAssignments: { select: { propertyId: true } },
        },
      });

      const result = new Set<string>();
      for (const sub of subs) {
        if (!sub.allProperties) {
          for (const pa of sub.propertyAssignments) {
            result.add(pa.propertyId);
          }
        }
        const childProps = await collectSubPropertyIds(sub.id);
        for (const p of childProps) result.add(p);
      }
      return result;
    };

    const subPropertyIds = await collectSubPropertyIds(userId);
    const blocked = [...subPropertyIds].filter((pid) => !newSet.has(pid));

    if (blocked.length > 0) {
      const properties = await prisma.property.findMany({
        where: { id: { in: blocked } },
        select: { name: true },
      });
      const names = properties.map((p) => p.name).join(", ");
      throw new Error(
        `Cannot remove properties (${names}) — subordinates still have access to them. Reassign subordinates first.`
      );
    }
  },

  async updateProperties(id: string, propertyIds: string[]) {
    if (propertyIds.length === 0) {
      const user = await prisma.user.findUnique({ where: { id }, select: { allProperties: true } });
      if (!user?.allProperties) {
        throw new Error("At least one property must be assigned to each user");
      }
    }

    // Check subordinate dependencies before removing properties
    await this.validatePropertyRemovalAgainstSubordinates(id, propertyIds);

    await prisma.userPropertyAssignment.deleteMany({ where: { userId: id } });

    if (propertyIds.length > 0) {
      await prisma.userPropertyAssignment.createMany({
        data: propertyIds.map((propertyId) => ({
          userId: id,
          propertyId,
        })),
      });
    }

    return this.findById(id);
  },

  async resetPassword(id: string, newPassword: string, resetByUserId?: string) {
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

    const result = await prisma.user.update({
      where: { id },
      data: { passwordHash },
      select: { id: true, username: true },
    });

    // Fire-and-forget notification (#14)
    if (resetByUserId && resetByUserId !== id) {
      notificationTrigger.onPasswordReset(id, resetByUserId).catch(console.error);
    }

    return result;
  },

  async deactivate(id: string, changedByUserId?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error("User not found");
    if (user.isSuperAdmin) throw new Error("Cannot deactivate super admin user");

    // Check for subordinates
    const subordinateCount = await prisma.user.count({ where: { reportsToId: id } });
    if (subordinateCount > 0) {
      throw new Error(
        `Cannot deactivate — this user has ${subordinateCount} subordinate(s). Reassign or remove them first. You can block access instead.`
      );
    }

    // Check for open assigned tickets
    const openTicketCount = await prisma.ticket.count({
      where: { assignedToId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
    });
    if (openTicketCount > 0) {
      throw new Error(
        `Cannot deactivate — this user has ${openTicketCount} open/in-progress ticket(s) assigned. Close or reassign them first. You can block access instead.`
      );
    }

    const result = await prisma.user.update({
      where: { id },
      data: { status: "INACTIVE" },
      include: { role: true },
    });

    // Fire-and-forget notification (#15)
    if (changedByUserId) {
      notificationTrigger.onUserStatusChanged(id, "deactivated", changedByUserId).catch(console.error);
    }

    return result;
  },

  async block(id: string, changedByUserId?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error("User not found");
    if (user.isSuperAdmin) throw new Error("Cannot block super admin user");

    const result = await prisma.user.update({
      where: { id },
      data: { status: "BLOCKED" },
      include: { role: true },
    });

    // Fire-and-forget notification (#15)
    if (changedByUserId) {
      notificationTrigger.onUserStatusChanged(id, "blocked", changedByUserId).catch(console.error);
    }

    return result;
  },

  async activate(id: string, changedByUserId?: string) {
    const result = await prisma.user.update({
      where: { id },
      data: { status: "ACTIVE" },
      include: { role: true },
    });

    // Fire-and-forget notification (#15)
    if (changedByUserId) {
      notificationTrigger.onUserStatusChanged(id, "activated", changedByUserId).catch(console.error);
    }

    return result;
  },

  async getManagerPropertyIds(managerId: string): Promise<string[] | "all"> {
    const manager = await prisma.user.findUnique({
      where: { id: managerId },
      select: {
        allProperties: true,
        isSuperAdmin: true,
        propertyAssignments: { select: { propertyId: true } },
      },
    });
    if (!manager) throw new Error("Manager not found");
    if (manager.allProperties || manager.isSuperAdmin) return "all";
    return manager.propertyAssignments.map((pa) => pa.propertyId);
  },

  async validatePropertyAccess(
    managerId: string,
    userAllProperties: boolean,
    userPropertyIds: string[]
  ) {
    const managerProps = await this.getManagerPropertyIds(managerId);
    if (managerProps === "all") return; // manager has access to everything

    if (userAllProperties) {
      throw new Error(
        "Cannot grant access to all properties — the manager only has access to specific properties"
      );
    }

    const managerSet = new Set(managerProps);
    const invalid = userPropertyIds.filter((id) => !managerSet.has(id));
    if (invalid.length > 0) {
      throw new Error(
        "Cannot assign properties that the reporting manager does not have access to"
      );
    }
  },

  async validateNoCircularChain(userId: string, reportsToId: string) {
    // Walk up the chain from reportsToId — if we ever hit userId, it's circular
    let currentId: string | null = reportsToId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === userId) {
        throw new Error("Cannot set reportsTo — this would create a circular reporting chain");
      }
      if (visited.has(currentId)) break; // safety: already visited
      visited.add(currentId);
      const ancestor: { reportsToId: string | null } | null = await prisma.user.findUnique({
        where: { id: currentId },
        select: { reportsToId: true },
      });
      currentId = ancestor?.reportsToId ?? null;
    }
  },

  async bulkCreate(
    items: {
      username: string;
      password: string;
      fullName?: string;
      email?: string;
      phone?: string;
      roleName: string;
      reportsToUsername?: string;
      allProperties?: string;
      propertyNames?: string;
    }[]
  ) {
    const roles = await prisma.role.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const roleMap = new Map(roles.map((r) => [r.name.toLowerCase(), r.id]));

    const existingUsers = await prisma.user.findMany({
      select: { id: true, username: true },
    });
    const userMap = new Map(existingUsers.map((u) => [u.username.toLowerCase(), u.id]));

    const allProperties = await prisma.property.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const propertyMap = new Map(allProperties.map((p) => [p.name.toLowerCase(), p.id]));

    const results: { row: number; status: string; username: string; error?: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.username || !item.password || !item.roleName) {
          results.push({ row: i + 1, status: "error", username: item.username || "", error: "username, password, and roleName are required" });
          continue;
        }

        if (userMap.has(item.username.toLowerCase())) {
          results.push({ row: i + 1, status: "error", username: item.username, error: "Username already exists" });
          continue;
        }

        const roleId = roleMap.get(item.roleName.toLowerCase());
        if (!roleId) {
          results.push({ row: i + 1, status: "error", username: item.username, error: `Role "${item.roleName}" not found` });
          continue;
        }

        let reportsToId: string | undefined;
        if (item.reportsToUsername) {
          reportsToId = userMap.get(item.reportsToUsername.toLowerCase());
          if (!reportsToId) {
            results.push({ row: i + 1, status: "error", username: item.username, error: `Reports-to user "${item.reportsToUsername}" not found` });
            continue;
          }
        }

        const isAllProps = item.allProperties?.toLowerCase() === "yes" || item.allProperties?.toLowerCase() === "true";
        let propertyIds: string[] = [];

        if (!isAllProps && item.propertyNames) {
          const names = item.propertyNames.split(";").map((n) => n.trim());
          for (const name of names) {
            const pid = propertyMap.get(name.toLowerCase());
            if (!pid) {
              results.push({ row: i + 1, status: "error", username: item.username, error: `Property "${name}" not found` });
              break;
            }
            propertyIds.push(pid);
          }
          if (results[results.length - 1]?.row === i + 1 && results[results.length - 1]?.status === "error") continue;
        }

        const passwordHash = await bcrypt.hash(item.password, env.BCRYPT_SALT_ROUNDS);

        const user = await prisma.user.create({
          data: {
            username: item.username,
            passwordHash,
            fullName: item.fullName || undefined,
            email: item.email || undefined,
            phone: item.phone || undefined,
            roleId,
            reportsToId,
            allProperties: isAllProps,
          },
        });

        // Track new user for subsequent rows that may reference it
        userMap.set(item.username.toLowerCase(), user.id);

        if (!isAllProps && propertyIds.length > 0) {
          await prisma.userPropertyAssignment.createMany({
            data: propertyIds.map((propertyId) => ({
              userId: user.id,
              propertyId,
            })),
          });
        }

        results.push({ row: i + 1, status: "success", username: item.username });
      } catch (err: any) {
        results.push({ row: i + 1, status: "error", username: item.username || "", error: err.message });
      }
    }

    return results;
  },

  async getSubordinates(id: string) {
    const result: any[] = [];

    const collectSubordinates = async (userId: string) => {
      const subordinates = await prisma.user.findMany({
        where: { reportsToId: userId },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: { select: { id: true, name: true, level: true } },
          reportsTo: { select: { id: true, fullName: true } },
        },
      });

      for (const sub of subordinates) {
        result.push(sub);
        await collectSubordinates(sub.id);
      }
    };

    await collectSubordinates(id);
    return result;
  },
};
