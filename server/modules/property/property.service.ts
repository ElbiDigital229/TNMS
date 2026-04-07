import { prisma } from "../../config/db.js";
import { CITY_CODES } from "../../../shared/types.js";
import type { City, PropertyType, Status } from "@prisma/client";
import { notificationTrigger } from "../../services/notificationTrigger.service.js";

export const propertyService = {
  async generateCode(city: City): Promise<string> {
    const prefix = CITY_CODES[city];

    const lastProperty = await prisma.property.findFirst({
      where: { city },
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let nextNum = 1;
    if (lastProperty) {
      const numPart = parseInt(lastProperty.code.slice(3), 10);
      nextNum = numPart + 1;
    }

    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  },

  async create(data: {
    name: string;
    type: PropertyType;
    city: City;
    description?: string;
    imagePath?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const code = await this.generateCode(data.city);

    // Auto-assign area group
    const areaGroup = await prisma.areaGroup.findUnique({
      where: { city: data.city },
    });

    return prisma.property.create({
      data: {
        ...data,
        code,
        areaGroupId: areaGroup?.id || null,
      },
      include: { areaGroup: true },
    });
  },

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    city?: City;
    type?: PropertyType;
    status?: Status;
    areaGroupId?: string;
    propertyIds?: string[];
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.propertyIds) where.id = { in: params.propertyIds };

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }
    if (params.city) where.city = params.city;
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.areaGroupId) where.areaGroupId = params.areaGroupId;

    const [data, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          areaGroup: true,
          _count: { select: { floors: true, units: true, assets: true, tickets: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.property.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id: string) {
    return prisma.property.findUnique({
      where: { id },
      include: {
        areaGroup: true,
        _count: { select: { floors: true, units: true, assets: true, tickets: true } },
      },
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      type?: PropertyType;
      city?: City;
      description?: string;
      imagePath?: string | null;
      latitude?: number;
      longitude?: number;
    }
  ) {
    // If city changes, re-assign area group
    let areaGroupId: string | null | undefined;
    if (data.city) {
      const areaGroup = await prisma.areaGroup.findUnique({
        where: { city: data.city },
      });
      areaGroupId = areaGroup?.id || null;
    }

    return prisma.property.update({
      where: { id },
      data: {
        ...data,
        ...(areaGroupId !== undefined ? { areaGroupId } : {}),
      },
      include: { areaGroup: true },
    });
  },

  async deactivate(id: string) {
    // Get property name before deactivation for notification
    const property = await prisma.property.findUnique({
      where: { id },
      select: { name: true },
    });

    // Cascade deactivation
    await prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: { status: "INACTIVE" },
      });

      await tx.floor.updateMany({
        where: { propertyId: id },
        data: { status: "INACTIVE" },
      });

      await tx.unit.updateMany({
        where: { propertyId: id },
        data: { status: "INACTIVE" },
      });

      await tx.asset.updateMany({
        where: { propertyId: id },
        data: { status: "INACTIVE" },
      });
    });

    // Fire-and-forget notification
    if (property) {
      notificationTrigger.onPropertyDeactivated(id, property.name).catch(console.error);
    }

    return prisma.property.findUnique({
      where: { id },
      include: { areaGroup: true },
    });
  },

  async activate(id: string) {
    // Cascade activation to match deactivation behavior
    await prisma.$transaction(async (tx) => {
      await tx.property.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      await tx.floor.updateMany({
        where: { propertyId: id },
        data: { status: "ACTIVE" },
      });

      await tx.unit.updateMany({
        where: { propertyId: id },
        data: { status: "ACTIVE" },
      });

      await tx.asset.updateMany({
        where: { propertyId: id },
        data: { status: "ACTIVE" },
      });
    });

    return prisma.property.findUnique({
      where: { id },
      include: { areaGroup: true },
    });
  },

  async findAllForExport(params: {
    search?: string;
    city?: City;
    type?: PropertyType;
    status?: Status;
    areaGroupId?: string;
    propertyIds?: string[];
  }) {
    const where: any = {};
    if (params.propertyIds) where.id = { in: params.propertyIds };
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }
    if (params.city) where.city = params.city;
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.areaGroupId) where.areaGroupId = params.areaGroupId;

    return prisma.property.findMany({
      where,
      include: {
        areaGroup: true,
        _count: { select: { floors: true, units: true, assets: true, tickets: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },
};
