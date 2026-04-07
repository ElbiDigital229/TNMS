import { prisma } from "../../config/db.js";

export const departmentService = {
  async findAll() {
    return prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        head: { select: { id: true, fullName: true, username: true } },
      },
    });
  },

  async create(name: string, headUserId?: string | null) {
    return prisma.department.create({
      data: { name, headUserId: headUserId || null },
      include: { head: { select: { id: true, fullName: true, username: true } } },
    });
  },

  async update(id: string, name: string, headUserId?: string | null) {
    if (headUserId) {
      // Validate head is in this department
      const u = await prisma.user.findUnique({
        where: { id: headUserId },
        select: { departmentId: true, status: true },
      });
      if (!u || u.departmentId !== id) {
        throw new Error("Department head must belong to this department");
      }
      if (u.status !== "ACTIVE") {
        throw new Error("Department head must be an active user");
      }
    }
    return prisma.department.update({
      where: { id },
      data: { name, headUserId: headUserId === undefined ? undefined : (headUserId || null) },
      include: { head: { select: { id: true, fullName: true, username: true } } },
    });
  },

  async deactivate(id: string) {
    return prisma.department.update({ where: { id }, data: { status: "INACTIVE" } });
  },

  async activate(id: string) {
    return prisma.department.update({ where: { id }, data: { status: "ACTIVE" } });
  },

  async getUsersByDepartment(departmentId: string) {
    return prisma.user.findMany({
      where: {
        departmentId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { fullName: "asc" },
    });
  },
};
