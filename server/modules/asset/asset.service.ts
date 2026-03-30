import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import type { AssetCondition } from "@prisma/client";
import { rbacService } from "../../services/rbac.service.js";
import { notificationTrigger } from "../../services/notificationTrigger.service.js";

export const assetService = {
  async generateCode(): Promise<string> {
    // Use raw query to find the max numeric code value, avoiding string sort issues
    const result = await prisma.$queryRaw<
      { max_num: number | null }[]
    >`SELECT MAX(CAST(SUBSTRING(code FROM 4) AS INTEGER)) as max_num FROM "Asset"`;

    const maxNum = result[0]?.max_num || 0;
    const nextNum = maxNum + 1;

    return `AST${String(nextNum).padStart(3, "0")}`;
  },

  async generateQRCode(assetCode: string): Promise<string> {
    const url = `${env.APP_BASE_URL}/asset-view/${assetCode}`;
    const qrDir = path.join("uploads", "qrcodes");

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    const qrPath = `uploads/qrcodes/${assetCode}.png`;
    await QRCode.toFile(qrPath, url, { width: 300, margin: 2 });
    return qrPath;
  },

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
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

    // Filter by user's assigned properties unless they have access to all
    if (params.userId && !params.allProperties) {
      const propertyIds = await rbacService.getUserPropertyIds(params.userId);
      if (propertyIds !== "all") {
        where.propertyId = { in: propertyIds };
      }
    }

    const [data, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          floor: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.asset.count({ where }),
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
    return prisma.asset.findMany({
      where: { propertyId },
      include: {
        floor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      include: {
        floor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        property: { select: { id: true, name: true, code: true } },
      },
    });
  },

  async findByCode(code: string) {
    return prisma.asset.findUnique({
      where: { code },
      include: {
        floor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        property: { select: { id: true, name: true, code: true } },
      },
    });
  },

  async create(data: {
    name: string;
    categoryId: string;
    unitOfMeasure: string;
    quantity?: number;
    condition: AssetCondition;
    additionalInfo?: string;
    floorId: string;
    propertyId: string;
    serialNumber?: string;
    purchaseDate?: Date;
    imagePath?: string;
  }) {
    const code = await this.generateCode();
    const qrCode = await this.generateQRCode(code);

    return prisma.asset.create({
      data: { ...data, code, qrCode },
      include: {
        floor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  },

  async update(
    id: string,
    data: {
      name?: string;
      categoryId?: string;
      unitOfMeasure?: string;
      quantity?: number;
      condition?: AssetCondition;
      additionalInfo?: string;
      floorId?: string;
      serialNumber?: string;
      purchaseDate?: Date;
      imagePath?: string;
    }
  ) {
    // Check if condition is changing to POOR
    let wasPoor = true;
    if (data.condition === "POOR") {
      const existing = await prisma.asset.findUnique({
        where: { id },
        select: { condition: true },
      });
      wasPoor = existing?.condition === "POOR";
    }

    const asset = await prisma.asset.update({
      where: { id },
      data,
      include: {
        floor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    // Fire-and-forget notification if condition just became POOR
    if (data.condition === "POOR" && !wasPoor) {
      notificationTrigger
        .onAssetConditionPoor(asset.id, asset.name, asset.code, (asset as any).property.id)
        .catch(console.error);
    }

    return asset;
  },

  async deactivate(id: string) {
    return prisma.asset.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
  },

  async activate(id: string) {
    return prisma.asset.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
  },

  async bulkCreate(
    propertyId: string,
    items: {
      name: string;
      categoryName: string;
      unitOfMeasure?: string;
      quantity?: number;
      condition?: string;
      floorName: string;
      serialNumber?: string;
      purchaseDate?: string;
      additionalInfo?: string;
    }[]
  ) {
    const categories = await prisma.assetCategory.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    const floors = await prisma.floor.findMany({
      where: { propertyId, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const floorMap = new Map(floors.map((f) => [f.name.toLowerCase(), f.id]));

    const validConditions = ["EXCELLENT", "GOOD", "FAIR", "POOR"];
    const results: { row: number; status: string; name: string; error?: string }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.name || !item.categoryName || !item.floorName) {
          results.push({ row: i + 1, status: "error", name: item.name || "", error: "name, categoryName, and floorName are required" });
          continue;
        }

        const conditionUpper = (item.condition || "GOOD").toUpperCase();
        if (!validConditions.includes(conditionUpper)) {
          results.push({ row: i + 1, status: "error", name: item.name, error: `Invalid condition "${item.condition}". Use: EXCELLENT, GOOD, FAIR, POOR` });
          continue;
        }

        const categoryId = categoryMap.get(item.categoryName.toLowerCase());
        if (!categoryId) {
          results.push({ row: i + 1, status: "error", name: item.name, error: `Category "${item.categoryName}" not found` });
          continue;
        }

        const floorId = floorMap.get(item.floorName.toLowerCase());
        if (!floorId) {
          results.push({ row: i + 1, status: "error", name: item.name, error: `Floor "${item.floorName}" not found in this property` });
          continue;
        }

        if (item.purchaseDate && new Date(item.purchaseDate) > new Date()) {
          results.push({ row: i + 1, status: "error", name: item.name, error: "Purchase date cannot be in the future" });
          continue;
        }

        const code = await this.generateCode();
        const qrCode = await this.generateQRCode(code);

        await prisma.asset.create({
          data: {
            code,
            name: item.name,
            categoryId,
            unitOfMeasure: item.unitOfMeasure || "NOS",
            quantity: item.quantity ? parseInt(String(item.quantity), 10) : 1,
            condition: conditionUpper as AssetCondition,
            floorId,
            propertyId,
            serialNumber: item.serialNumber || undefined,
            purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : undefined,
            additionalInfo: item.additionalInfo || undefined,
            qrCode,
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
