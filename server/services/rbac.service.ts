import { prisma } from "../config/db.js";
import { ALL_PERMISSION_KEYS, PERMISSIONS } from "../../shared/permissions.js";

export const rbacService = {
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user) return [];
    if (user.isSuperAdmin) return ALL_PERMISSION_KEYS;

    return user.role.permissions.map((rp) => rp.permission.key);
  },

  async getUserPropertyIds(userId: string): Promise<string[] | "all"> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true, allProperties: true, reportsToId: true },
    });

    if (!user) return [];
    if (user.isSuperAdmin || user.allProperties) return "all";

    // If user reports to someone, inherit manager's properties
    if (user.reportsToId) {
      return this.getUserPropertyIds(user.reportsToId);
    }

    const assignments = await prisma.userPropertyAssignment.findMany({
      where: { userId },
      select: { propertyId: true },
    });

    return assignments.map((a) => a.propertyId);
  },

  async getUserSubordinateIds(userId: string): Promise<string[]> {
    const result: string[] = [];
    const queue = [userId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const directReports = await prisma.user.findMany({
        where: { reportsToId: currentId, status: "ACTIVE" },
        select: { id: true },
      });

      for (const report of directReports) {
        result.push(report.id);
        queue.push(report.id);
      }
    }

    return result;
  },

  /** Check if a user has access to a specific property (respects inheritance) */
  async userHasPropertyAccess(userId: string, propertyId: string): Promise<boolean> {
    const propIds = await this.getUserPropertyIds(userId);
    return propIds === "all" || propIds.includes(propertyId);
  },

  async canAssignTo(
    assignerId: string,
    assigneeId: string,
    propertyId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Check assigner has tickets.assign permission
    const assignerPerms = await this.getUserPermissions(assignerId);
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      include: { role: true },
    });

    if (!assigner) return { allowed: false, reason: "Assigner not found" };

    if (
      !assigner.isSuperAdmin &&
      !assignerPerms.includes(PERMISSIONS.TICKETS.ASSIGN)
    ) {
      return { allowed: false, reason: "You do not have ticket assignment permission" };
    }

    // 2. Check assignee exists and is active
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!assignee) return { allowed: false, reason: "Assignee not found" };
    if (assignee.status === "INACTIVE") {
      return { allowed: false, reason: "Assignee is deactivated" };
    }

    // 3. Check assignee has tickets.assignee_eligible
    const assigneePerms = assignee.role.permissions.map((rp) => rp.permission.key);
    if (!assigneePerms.includes(PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE)) {
      return { allowed: false, reason: "This user cannot be assigned tickets" };
    }

    // Super admin bypasses hierarchy and level checks
    if (assigner.isSuperAdmin) {
      return { allowed: true };
    }

    // 4. Self-assignment: allowed if you are assignee-eligible yourself
    if (assignerId === assigneeId) {
      if (assignerPerms.includes(PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE)) {
        return { allowed: true };
      }
      return { allowed: false, reason: "Your role is not eligible for ticket assignment" };
    }

    // 5. Check assignee role level is at or below assigner's level
    if (assignee.role.level < assigner.role.level) {
      return { allowed: false, reason: "You cannot assign to someone above your role level" };
    }

    // 6. Check assignee has access to the property
    const assigneePropertyIds = await this.getUserPropertyIds(assigneeId);
    if (assigneePropertyIds !== "all" && !assigneePropertyIds.includes(propertyId)) {
      return { allowed: false, reason: "Assignee does not have access to this property" };
    }

    return { allowed: true };
  },

  async getAssignableUsers(assignerId: string, propertyId: string) {
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      include: { role: true },
    });

    if (!assigner) return [];

    // Build candidate list
    let candidateIds: string[];

    if (assigner.isSuperAdmin) {
      // Super admin: all active eligible users
      const allUsers = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          role: {
            permissions: {
              some: { permission: { key: PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE } },
            },
          },
        },
        select: { id: true },
      });
      candidateIds = allUsers.map((u) => u.id);
    } else {
      // Get all eligible users at same or lower level (FM, Supervisor, Technician etc.)
      const allEligible = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          role: {
            level: { gte: assigner.role.level },
            permissions: {
              some: { permission: { key: PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE } },
            },
          },
        },
        select: { id: true },
      });
      candidateIds = allEligible.map((u) => u.id);
      // Also include self if eligible
      const assignerPerms = await this.getUserPermissions(assignerId);
      if (assignerPerms.includes(PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE) && !candidateIds.includes(assignerId)) {
        candidateIds.push(assignerId);
      }
    }

    if (candidateIds.length === 0) return [];

    // Filter candidates by property access (respects inheritance)
    const withAccess: string[] = [];
    for (const cid of candidateIds) {
      if (await this.userHasPropertyAccess(cid, propertyId)) {
        withAccess.push(cid);
      }
    }

    if (withAccess.length === 0) return [];

    const users = await prisma.user.findMany({
      where: {
        id: { in: withAccess },
        status: "ACTIVE",
        role: {
          level: !assigner.isSuperAdmin && assigner.role.canAssignToMaxLevel !== null
            ? { lte: assigner.role.canAssignToMaxLevel }
            : undefined,
          permissions: {
            some: { permission: { key: PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE } },
          },
        },
      },
      include: { role: { select: { id: true, name: true, level: true } } },
      orderBy: [{ role: { level: "asc" } }, { fullName: "asc" }],
    });

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
    }));
  },
};
