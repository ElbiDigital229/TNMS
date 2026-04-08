import { prisma } from "../../config/db.js";

export const designationService = {
  async findAll() {
    return prisma.designation.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true } } },
    });
  },

  async create(name: string) {
    return prisma.designation.create({ data: { name } });
  },

  async update(id: string, name: string) {
    return prisma.designation.update({ where: { id }, data: { name } });
  },

  async deactivate(id: string) {
    return prisma.designation.update({ where: { id }, data: { status: "INACTIVE" } });
  },

  async activate(id: string) {
    return prisma.designation.update({ where: { id }, data: { status: "ACTIVE" } });
  },
};
