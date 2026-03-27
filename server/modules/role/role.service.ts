import { prisma } from "../../config/db.js";

export const roleService = {
  async findAll(activeOnly = false) {
    return prisma.role.findMany({
      where: activeOnly ? { status: "ACTIVE" } : undefined,
      orderBy: { level: "asc" },
      include: {
        _count: {
          select: { users: true, permissions: true },
        },
      },
    });
  },

  async findById(id: string) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });
  },

  async create(data: {
    name: string;
    level: number;
    canAssignToMaxLevel?: number;
    permissionIds: string[];
  }) {
    const existing = await prisma.role.findFirst({
      where: { name: data.name },
    });
    if (existing) {
      throw new Error("A role with this name already exists");
    }

    const uniquePermissionIds = [...new Set(data.permissionIds)];

    return prisma.role.create({
      data: {
        name: data.name,
        level: data.level,
        canAssignToMaxLevel: data.canAssignToMaxLevel,
        permissions: {
          create: uniquePermissionIds.map((permissionId) => ({
            permissionId,
          })),
        },
      },
      include: {
        permissions: {
          include: { permission: true },
        },
        _count: {
          select: { users: true },
        },
      },
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      level?: number;
      canAssignToMaxLevel?: number;
      permissionIds?: string[];
      expectedUpdatedAt?: string;
    }
  ) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new Error("Role not found");
    }

    // Optimistic locking: if caller provides expectedUpdatedAt, verify no concurrent edit
    if (data.expectedUpdatedAt) {
      const expected = new Date(data.expectedUpdatedAt).getTime();
      const actual = role.updatedAt.getTime();
      if (expected !== actual) {
        throw new Error("This role was modified by another user. Please refresh and try again.");
      }
    }

    // System roles can only have permissions changed
    if (role.isSystemRole) {
      if (data.name || data.level !== undefined) {
        throw new Error("Cannot change the name or level of a system role");
      }
    }

    // Check name uniqueness if changing name
    if (data.name && data.name !== role.name) {
      const existing = await prisma.role.findFirst({
        where: { name: data.name },
      });
      if (existing) {
        throw new Error("A role with this name already exists");
      }
    }

    return prisma.$transaction(async (tx) => {
      // Update permissions if provided
      if (data.permissionIds) {
        const uniquePermissionIds = [...new Set(data.permissionIds)];
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: uniquePermissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
        });
      }

      // Build update payload (exclude permissionIds)
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.level !== undefined) updateData.level = data.level;
      if (data.canAssignToMaxLevel !== undefined)
        updateData.canAssignToMaxLevel = data.canAssignToMaxLevel;

      return tx.role.update({
        where: { id },
        data: updateData,
        include: {
          permissions: {
            include: { permission: true },
          },
          _count: {
            select: { users: true },
          },
        },
      });
    });
  },

  async deactivate(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: { where: { status: "ACTIVE" } } },
        },
      },
    });

    if (!role) {
      throw new Error("Role not found");
    }

    if (role.isSystemRole) {
      throw new Error("Cannot deactivate a system role");
    }

    if (role._count.users > 0) {
      throw new Error(
        "Cannot deactivate a role that has active users assigned to it"
      );
    }

    return prisma.role.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  },

  async activate(id: string) {
    return prisma.role.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  },
};
