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
};
