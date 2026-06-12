import { prisma } from "../../../config/db.js";
import type { Prisma } from "@prisma/client";
import { createLandSchema } from "./land.schemas.js";
import {
  withCodeRetry,
  formatZodError,
  formatImportError,
} from "../_shared.js";

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

/** Agent include — includes deletedAt so the UI can show "(archived)". */
const AGENT_INCLUDE = {
  agent: {
    select: {
      id: true,
      agentCode: true,
      agentName: true,
      companyName: true,
      deletedAt: true,
    },
  },
} as const;

function normalizeUtilities(value: unknown): Utility[] {
  if (Array.isArray(value)) {
    return value.filter((u): u is Utility => UTILITY_VALUES.includes(u as Utility));
  }
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
  const nullableText = [
    "agentId", "areaLocation", "addressDescription", "coordinates",
    "developmentStatus", "parkingPotential", "ownerFlexibility", "notes",
    "lastAvailabilityCheck",
  ];
  for (const k of nullableText) {
    if (data[k] === "" || data[k] === undefined) data[k] = null;
  }
  for (const k of ["zoning", "proposedModel"]) {
    if (data[k] === "") data[k] = null;
  }
  for (const k of ["plotSizeKanal", "frontRoadWidthFt", "maxCoveredAreaSqft", "askingPrice"]) {
    if (data[k] === "" || data[k] === undefined) {
      data[k] = null;
    } else if (data[k] !== null && typeof data[k] !== "number") {
      const parsed = parseFloat(String(data[k]).replace(/,/g, ""));
      data[k] = Number.isNaN(parsed) ? null : parsed;
    }
  }
  if (data.lastAvailabilityCheck && typeof data.lastAvailabilityCheck === "string") {
    const d = new Date(data.lastAvailabilityCheck);
    data.lastAvailabilityCheck = Number.isNaN(d.getTime()) ? null : d;
  }
  data.utilities = normalizeUtilities(data.utilities);
  return data;
}

/**
 * Resolve a bulk-import row that uses `agentCode` (admin-friendly) into the
 * UUID-based `agentId` the create schema expects. Returns the modified row;
 * throws if the code is given but doesn't match any agent.
 */
async function resolveAgentCode(raw: Record<string, unknown>) {
  if (raw.agentCode && !raw.agentId) {
    const code = String(raw.agentCode).trim();
    const agent = await prisma.acquisitionAgent.findUnique({
      where: { agentCode: code },
      select: { id: true },
    });
    if (!agent) throw new Error(`Unknown agentCode: ${code}`);
    raw.agentId = agent.id;
    delete raw.agentCode;
  }
  return raw;
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
        include: AGENT_INCLUDE,
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
      include: AGENT_INCLUDE,
    });
  },

  async create(input: Record<string, unknown>) {
    const data = normalize(input) as Prisma.AcquisitionLandCreateInput;
    return withCodeRetry("LND", "AcquisitionLand", "landCode", (code) =>
      prisma.acquisitionLand.create({
        data: { ...data, landCode: code },
        include: AGENT_INCLUDE,
      }),
    );
  },

  async update(id: string, input: Record<string, unknown>) {
    const data = normalize(input);
    return prisma.acquisitionLand.update({
      where: { id },
      data,
      include: AGENT_INCLUDE,
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
        const raw = await resolveAgentCode({ ...items[i] });
        const parsed = createLandSchema.safeParse(raw);
        if (!parsed.success) {
          results.push({ row: i + 1, status: "error", error: formatZodError(parsed.error) });
          continue;
        }
        const created = await this.create(parsed.data as Record<string, unknown>);
        results.push({ row: i + 1, status: "success", id: created.id });
      } catch (e) {
        results.push({ row: i + 1, status: "error", error: formatImportError(e) });
      }
    }
    return results;
  },
};
