import { prisma } from "../../config/db.js";
import type { City } from "@prisma/client";

export const areaGroupService = {
  async findAll() {
    return prisma.areaGroup.findMany({
      orderBy: { city: "asc" },
    });
  },

  async upsert(city: City, groupName: string) {
    const areaGroup = await prisma.areaGroup.upsert({
      where: { city },
      update: { groupName },
      create: { city, groupName },
    });

    // Update all properties in this city to point to this area group
    await prisma.property.updateMany({
      where: { city },
      data: { areaGroupId: areaGroup.id },
    });

    return areaGroup;
  },
};
