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
      select: { isSuperAdmin: true, allProperties: true },
    });

    if (!user) return [];
    if (user.isSuperAdmin || user.allProperties) return "all";

    const assignments = await prisma.userPropertyAssignment.findMany({
      where: { userId },
      select: { propertyId: true },
    });

    return assignments.map((a) => a.propertyId);
  },

  /** Check if a user has access to a specific property (respects inheritance) */
  async userHasPropertyAccess(userId: string, propertyId: string): Promise<boolean> {
    const propIds = await this.getUserPropertyIds(userId);
    return propIds === "all" || propIds.includes(propertyId);
  },

  /**
   * Permissions-only assignment model (no role hierarchy):
   *   - Assigner must have tickets.assign
   *   - Assignee must be active and have tickets.assignee_eligible
   *   - Assignee must have property access
   * Super admins bypass everything.
   */
  async canAssignTo(
    assignerId: string,
    assigneeId: string,
    propertyId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const assignerPerms = await this.getUserPermissions(assignerId);
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      select: { id: true, isSuperAdmin: true },
    });

    if (!assigner) return { allowed: false, reason: "Assigner not found" };

    if (
      !assigner.isSuperAdmin &&
      !assignerPerms.includes(PERMISSIONS.TICKETS.ASSIGN)
    ) {
      return { allowed: false, reason: "You do not have ticket assignment permission" };
    }

    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    if (!assignee) return { allowed: false, reason: "Assignee not found" };
    if (assignee.status === "INACTIVE") {
      return { allowed: false, reason: "Assignee is deactivated" };
    }

    const assigneePerms = assignee.role.permissions.map((rp) => rp.permission.key);
    if (!assigneePerms.includes(PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE)) {
      return { allowed: false, reason: "This user cannot be assigned tickets" };
    }

    if (assigner.isSuperAdmin) {
      return { allowed: true };
    }

    // Self-assignment: allowed as long as you are assignee-eligible yourself.
    if (assignerId === assigneeId) {
      if (assignerPerms.includes(PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE)) {
        return { allowed: true };
      }
      return { allowed: false, reason: "Your role is not eligible for ticket assignment" };
    }

    // Property access check (respects inheritance / allProperties).
    const assigneePropertyIds = await this.getUserPropertyIds(assigneeId);
    if (assigneePropertyIds !== "all" && !assigneePropertyIds.includes(propertyId)) {
      return { allowed: false, reason: "Assignee does not have access to this property" };
    }

    return { allowed: true };
  },

  async getAssignableUsers(assignerId: string, propertyId: string) {
    const assigner = await prisma.user.findUnique({
      where: { id: assignerId },
      select: { id: true, isSuperAdmin: true },
    });

    if (!assigner) return [];

    // Everyone active with tickets.assignee_eligible is a candidate; scope by
    // property access below. No role-hierarchy filtering.
    const allEligible = await prisma.user.findMany({
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
    const candidateIds = allEligible.map((u) => u.id);

    if (candidateIds.length === 0) return [];

    // Filter candidates by property access (respects inheritance).
    const withAccess: string[] = [];
    for (const cid of candidateIds) {
      if (await this.userHasPropertyAccess(cid, propertyId)) {
        withAccess.push(cid);
      }
    }

    if (withAccess.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: withAccess }, status: "ACTIVE" },
      include: { role: { select: { id: true, name: true } } },
      orderBy: [{ fullName: "asc" }],
    });

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
    }));
  },
};
