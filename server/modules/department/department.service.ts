import { prisma } from "../../config/db.js";

export const departmentService = {
  async findAll() {
    return prisma.department.findMany({ orderBy: { name: "asc" } });
  },

  async create(name: string) {
    return prisma.department.create({ data: { name } });
  },

  async update(id: string, name: string) {
    return prisma.department.update({ where: { id }, data: { name } });
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
        role: { name: { in: ["Manager", "Supervisor", "Technician"] } },
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
