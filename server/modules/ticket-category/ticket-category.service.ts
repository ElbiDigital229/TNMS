import { prisma } from "../../config/db.js";

export const ticketCategoryService = {
  async findAll() {
    return prisma.ticketCategory.findMany({
      orderBy: { name: "asc" },
    });
  },

  async create(name: string) {
    return prisma.ticketCategory.create({ data: { name } });
  },

  async update(id: string, name: string) {
    return prisma.ticketCategory.update({
      where: { id },
      data: { name },
    });
  },

  async deactivate(id: string) {
    return prisma.ticketCategory.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  },

  async activate(id: string) {
    return prisma.ticketCategory.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  },
};
