import { prisma } from "../../config/db.js";
import { rbacService } from "../../services/rbac.service.js";

export const unitService = {
  async generateCode(): Promise<string> {
    const result = await prisma.$queryRaw<{ max_num: number }[]>`
      SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)), 0) AS max_num
      FROM "Unit" WHERE code ~ '^UNT[0-9]+$'
    `;
    const nextNum = (result[0]?.max_num ?? 0) + 1;
    return `UNT${String(nextNum).padStart(4, "0")}`;
  },


  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    propertyId?: string;
    floorId?: string;
    userId?: string;
    allProperties?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { code: { contains: params.search, mode: "insensitive" } },
      ];
    }
    if (params.status) where.status = params.status;
    if (params.propertyId) where.propertyId = params.propertyId;
    if (params.floorId) where.floorId = params.floorId;

    // Filter by user's assigned properties unless they have access to all.
    // Applied AFTER explicit propertyId so an unauthorized property filter
    // still gets narrowed to the user's scope.
    if (params.userId && !params.allProperties) {
      const propertyIds = await rbacService.getUserPropertyIds(params.userId);
      if (propertyIds !== "all") {
        where.propertyId = params.propertyId
          ? (propertyIds.includes(params.propertyId) ? params.propertyId : "__none__")
          : { in: propertyIds };
      }
    }

    const [data, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        include: {
          floor: { select: { id: true, name: true } },
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.unit.count({ where }),
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

  async findByProperty(propertyId: string) {
    return prisma.unit.findMany({
      where: { propertyId },
      include: { floor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  async create(data: {
    name: string;
    unitType?: string;
    floorId?: string;
    propertyId: string;
    description?: string;
  }) {
    // Duplicate check: same name in same property
    const existing = await prisma.unit.findFirst({
      where: {
        propertyId: data.propertyId,
        name: { equals: data.name.trim(), mode: "insensitive" },
      },
    });
    if (existing) {
      throw new Error(`A unit named "${data.name.trim()}" already exists in this property`);
    }

    const code = await this.generateCode();
    return prisma.unit.create({
      data: {
        code,
        name: data.name.trim(),
        unitType: data.unitType || null,
        floorId: data.floorId || null,
        propertyId: data.propertyId,
        description: data.description || null,
      },
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
    // Duplicate check if name is changing
    if (data.name) {
      const unit = await prisma.unit.findUnique({ where: { id }, select: { propertyId: true } });
      if (unit) {
        const existing = await prisma.unit.findFirst({
          where: {
            propertyId: unit.propertyId,
            name: { equals: data.name.trim(), mode: "insensitive" },
            id: { not: id },
          },
        });
        if (existing) {
          throw new Error(`A unit named "${data.name.trim()}" already exists in this property`);
        }
      }
    }

    return prisma.unit.update({
      where: { id },
      data: {
        ...data,
        name: data.name?.trim(),
      },
      include: { floor: { select: { id: true, name: true } } },
    });
  },

  async deactivate(id: string) {
    await prisma.unit.update({ where: { id }, data: { status: "INACTIVE" } });
    return prisma.unit.findUnique({
      where: { id },
      include: { floor: { select: { id: true, name: true } } },
    });
  },

  async activate(id: string) {
    await prisma.unit.update({ where: { id }, data: { status: "ACTIVE" } });
    return prisma.unit.findUnique({
      where: { id },
      include: { floor: { select: { id: true, name: true } } },
    });
  },

  async bulkDelete(ids: string[]) {
    // Cascade: delete all related records, then the units
    await prisma.$transaction(async (tx) => {
      // Delete ticket sub-records (assets, comments, activities) for tickets in these units
      await tx.ticketAsset.deleteMany({
        where: { ticket: { unitId: { in: ids } } },
      });
      await tx.ticketActivity.deleteMany({
        where: { ticket: { unitId: { in: ids } } },
      });
      await tx.ticketComment.deleteMany({
        where: { ticket: { unitId: { in: ids } } },
      });
      // Delete tickets in these units
      await tx.ticket.deleteMany({ where: { unitId: { in: ids } } });
      // Delete the units themselves
      await tx.unit.deleteMany({ where: { id: { in: ids } } });
    });
    return ids.length;
  },

  async bulkCreate(
    propertyId: string,
    items: { name: string; unitType?: string; floorName?: string; description?: string }[]
  ) {
    const floors = await prisma.floor.findMany({
      where: { propertyId, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const floorMap = new Map(floors.map((f) => [f.name.toLowerCase(), f.id]));

    // Load existing unit names in this property for duplicate check
    const existingUnits = await prisma.unit.findMany({
      where: { propertyId },
      select: { name: true },
    });
    const existingNames = new Set(existingUnits.map((u) => u.name.toLowerCase()));

    // Also track names within this import batch
    const batchNames = new Set<string>();

    // Pre-compute next code number to avoid collisions within batch
    const codeResult = await prisma.$queryRaw<{ max_num: number }[]>`
      SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)), 0) AS max_num
      FROM "Unit" WHERE code ~ '^UNT[0-9]+$'
    `;
    let nextCode = (codeResult[0]?.max_num ?? 0) + 1;

    const results: { row: number; status: string; name: string; error?: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.name) {
          results.push({ row: i + 1, status: "error", name: item.name || "", error: "Name is required" });
          continue;
        }

        const trimmedName = item.name.trim();
        const lowerName = trimmedName.toLowerCase();

        // Check against existing units in DB
        if (existingNames.has(lowerName)) {
          results.push({ row: i + 1, status: "error", name: trimmedName, error: `Unit "${trimmedName}" already exists in this property` });
          continue;
        }

        // Check against earlier rows in same batch
        if (batchNames.has(lowerName)) {
          results.push({ row: i + 1, status: "error", name: trimmedName, error: `Duplicate name "${trimmedName}" in import file` });
          continue;
        }

        // Resolve floor if provided
        let floorId: string | null = null;
        if (item.floorName?.trim()) {
          const resolved = floorMap.get(item.floorName.trim().toLowerCase());
          if (!resolved) {
            results.push({ row: i + 1, status: "error", name: trimmedName, error: `Floor "${item.floorName}" not found` });
            continue;
          }
          floorId = resolved;
        }

        const code = `UNT${String(nextCode++).padStart(4, "0")}`;
        await prisma.unit.create({
          data: {
            code,
            name: trimmedName,
            unitType: item.unitType?.trim() || null,
            floorId,
            propertyId,
            description: item.description?.trim() || null,
          },
        });

        // Track in both sets so subsequent rows detect it
        existingNames.add(lowerName);
        batchNames.add(lowerName);
        results.push({ row: i + 1, status: "success", name: trimmedName });
      } catch (err: any) {
        results.push({ row: i + 1, status: "error", name: item.name || "", error: err.message });
      }
    }

    return results;
  },
};
