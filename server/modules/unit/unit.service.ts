import { prisma } from "../../config/db.js";

export const unitService = {
  async generateCode(): Promise<string> {
    const lastUnit = await prisma.unit.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let nextNum = 1;
    if (lastUnit) {
      const numPart = parseInt(lastUnit.code.slice(3), 10);
      nextNum = numPart + 1;
    }

    return `UNT${String(nextNum).padStart(3, "0")}`;
  },

  async findByProperty(propertyId: string) {
    return prisma.unit.findMany({
      where: { propertyId },
      include: { floor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  async create(data: {
    name: string;
    unitType: string;
    floorId: string;
    propertyId: string;
    description?: string;
  }) {
    const code = await this.generateCode();
    return prisma.unit.create({
      data: { ...data, code },
      include: { floor: { select: { id: true, name: true } } },
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      unitType?: string;
      floorId?: string;
      description?: string;
    }
  ) {
    return prisma.unit.update({
      where: { id },
      data,
      include: { floor: { select: { id: true, name: true } } },
    });
  },

  async deactivate(id: string) {
    await prisma.$transaction(async (tx) => {
      await tx.unit.update({ where: { id }, data: { status: "INACTIVE" } });
      await tx.asset.updateMany({ where: { unitId: id }, data: { status: "INACTIVE" } });
    });
    return prisma.unit.findUnique({
      where: { id },
      include: { floor: { select: { id: true, name: true } } },
    });
  },

  async activate(id: string) {
    return prisma.unit.update({
      where: { id },
      data: { status: "ACTIVE" },
      include: { floor: { select: { id: true, name: true } } },
    });
  },

  async bulkCreate(
    propertyId: string,
    items: { name: string; unitType: string; floorName: string; description?: string }[]
  ) {
    const floors = await prisma.floor.findMany({
      where: { propertyId, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const floorMap = new Map(floors.map((f) => [f.name.toLowerCase(), f.id]));

    const results: { row: number; status: string; name: string; error?: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.name || !item.unitType || !item.floorName) {
          results.push({ row: i + 1, status: "error", name: item.name || "", error: "name, unitType, and floorName are required" });
          continue;
        }

        const floorId = floorMap.get(item.floorName.toLowerCase());
        if (!floorId) {
          results.push({ row: i + 1, status: "error", name: item.name, error: `Floor "${item.floorName}" not found` });
          continue;
        }

        const code = await this.generateCode();
        await prisma.unit.create({
          data: {
            code,
            name: item.name,
            unitType: item.unitType,
            floorId,
            propertyId,
            description: item.description || undefined,
          },
        });
        results.push({ row: i + 1, status: "success", name: item.name });
      } catch (err: any) {
        results.push({ row: i + 1, status: "error", name: item.name || "", error: err.message });
      }
    }

    return results;
  },
};
