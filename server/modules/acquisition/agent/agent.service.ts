import { prisma } from "../../../config/db.js";
import type { Prisma } from "@prisma/client";

/** Generate the next code in a "PREFIX-0001" sequence by scanning existing rows. */
async function generateNextCode(prefix: string): Promise<string> {
  const last = await prisma.acquisitionAgent.findFirst({
    where: { agentCode: { startsWith: `${prefix}-` } },
    orderBy: { agentCode: "desc" },
    select: { agentCode: true },
  });
  let n = 1;
  if (last) {
    const parsed = parseInt(last.agentCode.split("-")[1] ?? "0", 10);
    if (!Number.isNaN(parsed)) n = parsed + 1;
  }
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

/** Activity counter — non-closed deals across both inventories. */
async function activeDealsCount(agentId: string): Promise<number> {
  const [land, building] = await Promise.all([
    prisma.acquisitionLand.count({
      where: {
        agentId,
        deletedAt: null,
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
    }),
    prisma.acquisitionBuilding.count({
      where: {
        agentId,
        deletedAt: null,
        stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
      },
    }),
  ]);
  return land + building;
}

function normalize(input: Record<string, unknown>) {
  const data: Record<string, unknown> = { ...input };
  // Coerce empty strings to null for optional text/date columns.
  const nullables = ["companyName", "email", "areaFocus", "firstContactDate", "lastAvailabilityCheck", "notes"];
  for (const k of nullables) {
    if (data[k] === "" || data[k] === undefined) data[k] = null;
  }
  // Date coercion
  for (const k of ["firstContactDate", "lastAvailabilityCheck"] as const) {
    if (data[k] && typeof data[k] === "string") {
      const d = new Date(data[k] as string);
      data[k] = Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return data;
}

export const agentService = {
  async findAll(opts: {
    page?: number;
    limit?: number;
    search?: string;
    status?: "ACTIVE" | "INACTIVE";
    sourceType?: "BROKER" | "OWNER" | "CONSULTANT";
    city?: string;
    includeDeleted?: boolean;
  }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const where: Prisma.AcquisitionAgentWhereInput = {};
    if (!opts.includeDeleted) where.deletedAt = null;
    if (opts.status) where.status = opts.status;
    if (opts.sourceType) where.sourceType = opts.sourceType;
    if (opts.city) where.city = { contains: opts.city, mode: "insensitive" };
    if (opts.search) {
      where.OR = [
        { agentCode: { contains: opts.search, mode: "insensitive" } },
        { agentName: { contains: opts.search, mode: "insensitive" } },
        { companyName: { contains: opts.search, mode: "insensitive" } },
        { contactNumber: { contains: opts.search, mode: "insensitive" } },
        { email: { contains: opts.search, mode: "insensitive" } },
        { city: { contains: opts.search, mode: "insensitive" } },
        { areaFocus: { contains: opts.search, mode: "insensitive" } },
        { notes: { contains: opts.search, mode: "insensitive" } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.acquisitionAgent.count({ where }),
      prisma.acquisitionAgent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Attach activeDeals counts
    const enriched = await Promise.all(
      rows.map(async (a) => ({ ...a, activeDeals: await activeDealsCount(a.id) })),
    );

    return {
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async findById(id: string) {
    const agent = await prisma.acquisitionAgent.findUnique({ where: { id } });
    if (!agent) return null;
    return { ...agent, activeDeals: await activeDealsCount(id) };
  },

  async findDeals(agentId: string) {
    const [lands, buildings] = await Promise.all([
      prisma.acquisitionLand.findMany({
        where: { agentId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.acquisitionBuilding.findMany({
        where: { agentId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { lands, buildings };
  },

  async create(input: Record<string, unknown>) {
    const data = normalize(input) as Prisma.AcquisitionAgentCreateInput;
    data.agentCode = await generateNextCode("AGT");
    return prisma.acquisitionAgent.create({ data });
  },

  async update(id: string, input: Record<string, unknown>) {
    const data = normalize(input);
    return prisma.acquisitionAgent.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.acquisitionAgent.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  },

  async restore(id: string) {
    return prisma.acquisitionAgent.update({
      where: { id },
      data: { deletedAt: null, status: "ACTIVE" },
    });
  },

  async bulkCreate(items: Record<string, unknown>[]) {
    const results: { row: number; status: "success" | "error"; id?: string; error?: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        const created = await this.create(items[i]);
        results.push({ row: i + 1, status: "success", id: created.id });
      } catch (e: any) {
        results.push({ row: i + 1, status: "error", error: e?.message || "Unknown error" });
      }
    }
    return results;
  },
};
