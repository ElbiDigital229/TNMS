import { prisma } from "../../config/db.js";

export const assetCategoryService = {
  async findAll() {
    return prisma.assetCategory.findMany({
      orderBy: { createdAt: "asc" },
    });
  },

  async create(name: string) {
    return prisma.assetCategory.create({ data: { name } });
  },

  async update(id: string, name: string) {
    return prisma.assetCategory.update({ where: { id }, data: { name } });
  },

  async deactivate(id: string) {
    return prisma.assetCategory.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  },

  async activate(id: string) {
    return prisma.assetCategory.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  },
};
