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

// Bulk create floors from CSV import
export async function bulkCreateFloors(
  propertyId: string,
  items: { name: string }[]
) {
  const existingFloors = await prisma.floor.findMany({
    where: { propertyId },
    select: { name: true },
  });
  const existingNames = new Set(existingFloors.map((f) => f.name.toLowerCase()));
  const batchNames = new Set<string>();

  const results: { row: number; status: string; name: string; error?: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      if (!item.name) {
        results.push({ row: i + 1, status: "error", name: "", error: "Floor name is required" });
        continue;
      }
      const trimmedName = item.name.trim();
      const lowerName = trimmedName.toLowerCase();

      if (existingNames.has(lowerName)) {
        results.push({ row: i + 1, status: "error", name: trimmedName, error: `Floor "${trimmedName}" already exists in this property` });
        continue;
      }
      if (batchNames.has(lowerName)) {
        results.push({ row: i + 1, status: "error", name: trimmedName, error: `Duplicate name "${trimmedName}" in import file` });
        continue;
      }

      await prisma.floor.create({
        data: { name: trimmedName, propertyId },
      });

      existingNames.add(lowerName);
      batchNames.add(lowerName);
      results.push({ row: i + 1, status: "success", name: trimmedName });
    } catch (err: any) {
      results.push({ row: i + 1, status: "error", name: item.name || "", error: err.message });
    }
  }
  return results;
}


export async function bulkDeleteFloors(ids: string[]) {
  return prisma.$transaction(async (tx) => {
    // Delete ticket sub-records for tickets in units on these floors
    await tx.ticketAsset.deleteMany({ where: { ticket: { unit: { floorId: { in: ids } } } } });
    await tx.ticketActivity.deleteMany({ where: { ticket: { unit: { floorId: { in: ids } } } } });
    await tx.ticketComment.deleteMany({ where: { ticket: { unit: { floorId: { in: ids } } } } });
    await tx.ticket.deleteMany({ where: { unit: { floorId: { in: ids } } } });
    await tx.asset.deleteMany({ where: { floorId: { in: ids } } });
    await tx.unit.deleteMany({ where: { floorId: { in: ids } } });
    const result = await tx.floor.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  });
}
