import { prisma } from "../../config/db.js";

export const floorService = {
  async findByProperty(propertyId: string) {
    return prisma.floor.findMany({
      where: { propertyId },
      orderBy: { createdAt: "asc" },
    });
  },

  async create(propertyId: string, name: string) {
    return prisma.floor.create({
      data: { name, propertyId },
    });
  },

  async update(id: string, name: string) {
    return prisma.floor.update({
      where: { id },
      data: { name },
    });
  },

  async deactivate(id: string) {
    // Cascade to units and assets
    await prisma.$transaction(async (tx) => {
      await tx.floor.update({ where: { id }, data: { status: "INACTIVE" } });
      const units = await tx.unit.findMany({ where: { floorId: id }, select: { id: true } });
      if (units.length > 0) {
        await tx.unit.updateMany({ where: { floorId: id }, data: { status: "INACTIVE" } });
        await tx.asset.updateMany({
          where: { floorId: id },
          data: { status: "INACTIVE" },
        });
      }
    });
    return prisma.floor.findUnique({ where: { id } });
  },

  async activate(id: string) {
    // Cascade activation to match deactivation behavior
    await prisma.$transaction(async (tx) => {
      await tx.floor.update({ where: { id }, data: { status: "ACTIVE" } });
      const units = await tx.unit.findMany({ where: { floorId: id }, select: { id: true } });
      if (units.length > 0) {
        await tx.unit.updateMany({ where: { floorId: id }, data: { status: "ACTIVE" } });
        await tx.asset.updateMany({
          where: { floorId: id },
          data: { status: "ACTIVE" },
        });
      }
    });
    return prisma.floor.findUnique({ where: { id } });
  },
};
