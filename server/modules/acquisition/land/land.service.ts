import { prisma } from "../../../config/db.js";
import type { Prisma } from "@prisma/client";

const UTILITY_VALUES = [
  "WATER",
  "GAS",
  "ELECTRICITY",
  "SEWERAGE",
  "INTERNET",
  "PHONE",
  "BOREWELL",
  "SOLAR",
] as const;
type Utility = (typeof UTILITY_VALUES)[number];

async function generateNextCode(): Promise<string> {
  const last = await prisma.acquisitionLand.findFirst({
    where: { landCode: { startsWith: "LND-" } },
    orderBy: { landCode: "desc" },
    select: { landCode: true },
  });
  let n = 1;
  if (last) {
    const parsed = parseInt(last.landCode.split("-")[1] ?? "0", 10);
    if (!Number.isNaN(parsed)) n = parsed + 1;
  }
  return `LND-${String(n).padStart(4, "0")}`;
}

function normalizeUtilities(value: unknown): Utility[] {
  if (Array.isArray(value)) {
    return value.filter((u): u is Utility => UTILITY_VALUES.includes(u as Utility));
  }
  // CSV-friendly: accept "WATER|GAS" or "WATER,GAS" strings.
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[|,]/)
      .map((s) => s.trim().toUpperCase())
      .filter((s): s is Utility => UTILITY_VALUES.includes(s as Utility));
  }
  return [];
}

function normalize(input: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...input };
  // Empty-string → null
  const nullableText = [
    "agentId", "areaLocation", "addressDescription", "coordinates",
    "developmentStatus", "parkingPotential", "ownerFlexibility", "notes",
    "lastAvailabilityCheck",
  ];
  for (const k of nullableText) {
    if (data[k] === "" || data[k] === undefined) data[k] = null;
  }
  // Empty-string enums → null
  for (const k of ["zoning", "proposedModel"]) {
    if (data[k] === "") data[k] = null;
  }
  // Decimal coercion
  for (const k of ["plotSizeKanal", "frontRoadWidthFt", "maxCoveredAreaSqft", "askingPrice"]) {
    if (data[k] === "" || data[k] === undefined) {
      data[k] = null;
    } else if (data[k] !== null && typeof data[k] !== "number") {
      const parsed = parseFloat(String(data[k]).replace(/,/g, ""));
      data[k] = Number.isNaN(parsed) ? null : parsed;
    }
  }
  // Date coercion
  if (data.lastAvailabilityCheck && typeof data.lastAvailabilityCheck === "string") {
    const d = new Date(data.lastAvailabilityCheck);
    data.lastAvailabilityCheck = Number.isNaN(d.getTime()) ? null : d;
  }
  // Utilities
  data.utilities = normalizeUtilities(data.utilities);
  return data;
}

export const landService = {
  async findAll(opts: {
    page?: number;
    limit?: number;
    search?: string;
    agentId?: string;
    status?: "ACTIVE" | "INACTIVE";
    stage?: "REVIEW" | "VISIT" | "NEGOTIATION" | "CLOSED_WON" | "CLOSED_LOST";
    zoning?: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE";
    city?: string;
    includeDeleted?: boolean;
  }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const where: Prisma.AcquisitionLandWhereInput = {};
    if (!opts.includeDeleted) where.deletedAt = null;
    if (opts.status) where.status = opts.status;
    if (opts.stage) where.stage = opts.stage;
    if (opts.zoning) where.zoning = opts.zoning;
    if (opts.agentId) where.agentId = opts.agentId;
    if (opts.city) where.city = { contains: opts.city, mode: "insensitive" };
    if (opts.search) {
      where.OR = [
        { landCode: { contains: opts.search, mode: "insensitive" } },
        { city: { contains: opts.search, mode: "insensitive" } },
        { areaLocation: { contains: opts.search, mode: "insensitive" } },
        { addressDescription: { contains: opts.search, mode: "insensitive" } },
        { notes: { contains: opts.search, mode: "insensitive" } },
      ];
    }

    const [total, data] = await Promise.all([
      prisma.acquisitionLand.count({ where }),
      prisma.acquisitionLand.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          agent: { select: { id: true, agentCode: true, agentName: true, companyName: true } },
        },
      }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async findById(id: string) {
    return prisma.acquisitionLand.findUnique({
      where: { id },
      include: {
        agent: { select: { id: true, agentCode: true, agentName: true, companyName: true } },
      },
    });
  },

  async create(input: Record<string, unknown>) {
    const data = normalize(input) as Prisma.AcquisitionLandCreateInput;
    (data as any).landCode = await generateNextCode();
    return prisma.acquisitionLand.create({
      data,
      include: {
        agent: { select: { id: true, agentCode: true, agentName: true, companyName: true } },
      },
    });
  },

  async update(id: string, input: Record<string, unknown>) {
    const data = normalize(input);
    return prisma.acquisitionLand.update({
      where: { id },
      data,
      include: {
        agent: { select: { id: true, agentCode: true, agentName: true, companyName: true } },
      },
    });
  },

  async softDelete(id: string) {
    return prisma.acquisitionLand.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  },

  async restore(id: string) {
    return prisma.acquisitionLand.update({
      where: { id },
      data: { deletedAt: null, status: "ACTIVE" },
    });
  },

  async bulkCreate(items: Record<string, unknown>[]) {
    const results: { row: number; status: "success" | "error"; id?: string; error?: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        // Allow CSV to reference agent by code instead of UUID.
        const raw = items[i];
        if (raw.agentCode && !raw.agentId) {
          const agent = await prisma.acquisitionAgent.findUnique({
            where: { agentCode: String(raw.agentCode) },
            select: { id: true },
          });
          if (!agent) throw new Error(`Unknown agentCode: ${raw.agentCode}`);
          raw.agentId = agent.id;
        }
        const created = await this.create(raw);
        results.push({ row: i + 1, status: "success", id: created.id });
      } catch (e: any) {
        results.push({ row: i + 1, status: "error", error: e?.message || "Unknown error" });
      }
    }
    return results;
  },
};
