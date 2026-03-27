import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import type { AssetCondition } from "@prisma/client";

export const assetService = {
  async generateCode(): Promise<string> {
    const lastAsset = await prisma.asset.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let nextNum = 1;
    if (lastAsset) {
      const numPart = parseInt(lastAsset.code.slice(3), 10);
      nextNum = numPart + 1;
    }

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

    const [data, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        include: {
          unit: { select: { id: true, name: true, code: true } },
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
        unit: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            code: true,
            floor: { select: { id: true, name: true } },
          },
        },
        category: { select: { id: true, name: true } },
        property: { select: { id: true, name: true, code: true } },
      },
    });
  },

  async findByCode(code: string) {
    return prisma.asset.findUnique({
      where: { code },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            code: true,
            floor: { select: { id: true, name: true } },
          },
        },
        category: { select: { id: true, name: true } },
        property: { select: { id: true, name: true, code: true } },
      },
    });
  },

  async create(data: {
    name: string;
    categoryId: string;
    unitOfMeasure: string;
    condition: AssetCondition;
    additionalInfo?: string;
    unitId: string;
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
        unit: { select: { id: true, name: true, code: true } },
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
      condition?: AssetCondition;
      additionalInfo?: string;
      unitId?: string;
      serialNumber?: string;
      purchaseDate?: Date;
      imagePath?: string;
    }
  ) {
    return prisma.asset.update({
      where: { id },
      data,
      include: {
        unit: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
      },
    });
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
};
