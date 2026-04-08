import bcrypt from "bcrypt";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import type { Status } from "@prisma/client";
import { notificationTrigger } from "../../services/notificationTrigger.service.js";

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
        { employeeCode: { contains: params.search, mode: "insensitive" } },
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
          employeeCode: true,
          designation: { select: { id: true, name: true } },
          email: true,
          phone: true,
          status: true,
          allProperties: true,
          isSuperAdmin: true,
          role: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          propertyAssignments: {
            select: { property: { select: { id: true, name: true } } },
          },
          _count: { select: { propertyAssignments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data,
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
        propertyAssignments: {
          include: {
            property: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  },

  async create(data: {
    username: string;
    password: string;
    fullName?: string;
    employeeCode?: string;
    designationId?: string | null;
    email?: string;
    phone?: string;
    roleId: string;
    allProperties?: boolean;
    propertyIds?: string[];
    departmentId?: string | null;
  }) {
    const effectivePropertyIds = data.propertyIds ?? [];
    const effectiveAllProperties = data.allProperties ?? false;

    // Must have at least one property
    if (!effectiveAllProperties && effectivePropertyIds.length === 0) {
      throw new Error("At least one property must be assigned to each user");
    }

    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);

    const { propertyIds, password, ...userData } = data;

    const user = await prisma.user.create({
      data: {
        ...userData,
        allProperties: effectiveAllProperties,
        passwordHash,
        // Admin-created users must pick their own password on first login.
        mustChangePassword: true,
      },
      include: {
        role: true,
      },
    });

    if (effectivePropertyIds.length > 0 && !effectiveAllProperties) {
      await prisma.userPropertyAssignment.createMany({
        data: effectivePropertyIds.map((propertyId) => ({
          userId: user.id,
          propertyId,
        })),
      });
    }

    return this.findById(user.id);
  },

  async update(
    id: string,
    data: {
      fullName?: string;
      employeeCode?: string;
      designationId?: string | null;
      email?: string;
      phone?: string;
      roleId?: string;
      allProperties?: boolean;
      propertyIds?: string[];
      departmentId?: string | null;
    }
  ) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new Error("User not found");
    if (existing.isSuperAdmin) throw new Error("Cannot modify super admin user");

    const { propertyIds, ...userData } = data;

    // Track changes for notification
    const changes: string[] = [];
    if (data.roleId && data.roleId !== existing.roleId) {
      const newRole = await prisma.role.findUnique({ where: { id: data.roleId }, select: { name: true } });
      if (newRole) changes.push(`role changed to ${newRole.name}`);
    }

    // Bump tokenVersion when role changes, so the old JWT with stale
    // permissions is immediately rejected by authenticate middleware.
    const roleChanged = data.roleId && data.roleId !== existing.roleId;
    await prisma.user.update({
      where: { id },
      data: {
        ...userData,
        ...(roleChanged ? { tokenVersion: { increment: 1 } } : {}),
      },
    });

    if (propertyIds) {
      // Must have at least one property
      if (!data.allProperties && propertyIds.length === 0) {
        throw new Error("At least one property must be assigned to each user");
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

    return this.findById(id);
  },

  async updateProperties(id: string, propertyIds: string[]) {
    if (propertyIds.length === 0) {
      const user = await prisma.user.findUnique({ where: { id }, select: { allProperties: true } });
      if (!user?.allProperties) {
        throw new Error("At least one property must be assigned to each user");
      }
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

    return this.findById(id);
  },

  async resetPassword(id: string, newPassword: string, resetByUserId?: string) {
    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

    const result = await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        // Invalidate all existing sessions and force the user to pick a
        // new password on next login if an admin reset it for them.
        tokenVersion: { increment: 1 },
        mustChangePassword: resetByUserId && resetByUserId !== id ? true : false,
      },
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

    // Check for open assigned tickets
    const openTicketCount = await prisma.ticket.count({
      where: { assignedToId: id, status: { in: ["UNASSIGNED", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] } },
    });
    if (openTicketCount > 0) {
      throw new Error(
        `Cannot deactivate — this user has ${openTicketCount} open/in-progress ticket(s) assigned. Close or reassign them first. You can block access instead.`
      );
    }

    const result = await prisma.user.update({
      where: { id },
      data: { status: "INACTIVE", tokenVersion: { increment: 1 } },
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
      data: { status: "BLOCKED", tokenVersion: { increment: 1 } },
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

  async bulkCreate(
    items: {
      fullName?: string;
      employeeCode?: string;
      designation?: string;
      email: string;
      department?: string;
      role: string;
      group?: string;
      specific?: string;
    }[]
  ) {
    const roles = await prisma.role.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const roleMap = new Map(roles.map((r) => [r.name.toLowerCase(), r.id]));

    const departments = await prisma.department.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const departmentMap = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

    const designations = await prisma.designation.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const designationMap = new Map(designations.map((d) => [d.name.toLowerCase(), d.id]));

    const existingUsers = await prisma.user.findMany({
      select: { id: true, username: true, email: true, employeeCode: true },
    });
    const userByEmailMap = new Map(
      existingUsers.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.id])
    );
    const userMap = new Map(existingUsers.map((u) => [u.username.toLowerCase(), u.id]));
    const employeeCodeSet = new Set(
      existingUsers.filter((u) => u.employeeCode).map((u) => u.employeeCode!.toLowerCase())
    );

    const allProps = await prisma.property.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, areaGroupId: true },
    });
    const propertyById = new Map(allProps.map((p) => [p.id, p]));

    const areaGroups = await prisma.areaGroup.findMany({
      select: { id: true, groupName: true },
    });
    const areaGroupMap = new Map(areaGroups.map((ag) => [ag.groupName.toLowerCase(), ag.id]));

    // Trim trailing/leading whitespace on names so e.g. "Vanguard " in DB matches "Vanguard" in CSV
    const propertyByName = new Map(allProps.map((p) => [p.name.trim().toLowerCase(), p]));

    const results: { row: number; status: string; email: string; error?: string }[] = [];

    const defaultPasswordHash = await bcrypt.hash("Welcome@123", env.BCRYPT_SALT_ROUNDS);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.email || !item.role) {
          results.push({ row: i + 1, status: "error", email: item.email || "", error: "Email and Role are required" });
          continue;
        }

        if (userMap.has(item.email.toLowerCase()) || userByEmailMap.has(item.email.toLowerCase())) {
          results.push({ row: i + 1, status: "error", email: item.email, error: "Email already exists" });
          continue;
        }

        if (item.employeeCode && employeeCodeSet.has(item.employeeCode.toLowerCase())) {
          results.push({ row: i + 1, status: "error", email: item.email, error: `Employee Code "${item.employeeCode}" already exists` });
          continue;
        }

        const roleId = roleMap.get(item.role.toLowerCase());
        if (!roleId) {
          results.push({ row: i + 1, status: "error", email: item.email, error: `Role "${item.role}" not found` });
          continue;
        }

        let departmentId: string | undefined;
        if (item.department) {
          departmentId = departmentMap.get(item.department.toLowerCase());
          if (!departmentId) {
            results.push({ row: i + 1, status: "error", email: item.email, error: `Department "${item.department}" not found` });
            continue;
          }
        }

        let designationId: string | undefined;
        if (item.designation) {
          designationId = designationMap.get(item.designation.toLowerCase());
          if (!designationId) {
            results.push({ row: i + 1, status: "error", email: item.email, error: `Designation "${item.designation}" not found` });
            continue;
          }
        }

        // Resolve property access. Group takes precedence — if Group is set
        // (and not N/A), Specific is ignored. Specific is only consulted when
        // Group is empty or N/A.
        let isAllProperties = false;
        let propertyIds: string[] = [];
        let resolvedFromGroup = false;

        const group = item.group?.trim();
        const groupLower = group?.toLowerCase();
        const isNoGroup = !group || groupLower === "n/a" || groupLower === "na" || groupLower === "-" || groupLower === "none";

        if (!isNoGroup) {
          if (groupLower === "all") {
            isAllProperties = true;
            resolvedFromGroup = true;
          } else {
            const areaGroupId = areaGroupMap.get(groupLower!);
            if (areaGroupId) {
              propertyIds = allProps
                .filter((p) => p.areaGroupId === areaGroupId)
                .map((p) => p.id);
              if (propertyIds.length === 0) {
                results.push({ row: i + 1, status: "error", email: item.email, error: `No active properties found in group "${group}"` });
                continue;
              }
              resolvedFromGroup = true;
            } else {
              // Treat as a property name
              const prop = propertyByName.get(groupLower!.trim());
              if (prop) {
                propertyIds = [prop.id];
                resolvedFromGroup = true;
              } else {
                results.push({ row: i + 1, status: "error", email: item.email, error: `Group "${group}" is not "All", "N/A", a valid area group, or property name` });
                continue;
              }
            }
          }
        }

        // Specific is consulted only if Group did not resolve anything
        if (!resolvedFromGroup && item.specific?.trim()) {
          const specificNames = item.specific.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
          propertyIds = [];
          let specificError = false;
          for (const name of specificNames) {
            const prop = propertyByName.get(name);
            if (prop) {
              propertyIds.push(prop.id);
            } else {
              results.push({ row: i + 1, status: "error", email: item.email, error: `Property "${name}" not found` });
              specificError = true;
              break;
            }
          }
          if (specificError) continue;
        }

        // Must have at least one property if not allProperties
        if (!isAllProperties && propertyIds.length === 0) {
          results.push({ row: i + 1, status: "error", email: item.email, error: "No property access specified — set Group or Specific" });
          continue;
        }

        const createData: Record<string, unknown> = {
          username: item.email,
          passwordHash: defaultPasswordHash,
          fullName: item.fullName || null,
          employeeCode: item.employeeCode || null,
          designationId: designationId || null,
          email: item.email,
          roleId,
          allProperties: isAllProperties,
        };
        if (departmentId) createData.departmentId = departmentId;

        const user = await prisma.user.create({ data: createData as any });

        // Track new user so subsequent rows can reference them
        userMap.set(item.email.toLowerCase(), user.id);
        userByEmailMap.set(item.email.toLowerCase(), user.id);
        if (item.employeeCode) employeeCodeSet.add(item.employeeCode.toLowerCase());

        if (!isAllProperties && propertyIds.length > 0) {
          await prisma.userPropertyAssignment.createMany({
            data: propertyIds.map((propertyId) => ({
              userId: user.id,
              propertyId,
            })),
          });
        }

        results.push({ row: i + 1, status: "success", email: item.email });
      } catch (err: any) {
        results.push({ row: i + 1, status: "error", email: item.email || "", error: err.message });
      }
    }

    return results;
  },

};
