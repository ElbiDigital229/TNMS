import { prisma } from "../../config/db.js";

export const ppmService = {
  async findAll(params: { status?: string; search?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }
    return prisma.ppm.findMany({
      where,
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { tickets: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.ppm.findUniqueOrThrow({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { tickets: true } },
      },
    });
  },

  async create(data: {
    name: string;
    description?: string | null;
    steps: { text: string }[];
  }) {
    const existing = await prisma.ppm.findFirst({
      where: { name: { equals: data.name.trim(), mode: "insensitive" } },
    });
    if (existing) {
      throw new Error(`A PPM named "${data.name.trim()}" already exists`);
    }
    return prisma.ppm.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        steps: {
          create: data.steps.map((s, i) => ({ order: i, text: s.text.trim() })),
        },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  },

  async update(
    id: string,
    data: { name?: string; description?: string | null; steps?: { text: string }[] },
  ) {
    if (data.name) {
      const dupe = await prisma.ppm.findFirst({
        where: {
          name: { equals: data.name.trim(), mode: "insensitive" },
          id: { not: id },
        },
      });
      if (dupe) throw new Error(`A PPM named "${data.name.trim()}" already exists`);
    }

    // If steps are provided, replace them wholesale. Simpler than diffing
    // and keeps the caller's order authoritative. Snapshotted TicketPpmStep
    // rows on already-generated tickets are untouched.
    return prisma.$transaction(async (tx) => {
      if (data.steps) {
        await tx.ppmStep.deleteMany({ where: { ppmId: id } });
        await tx.ppmStep.createMany({
          data: data.steps.map((s, i) => ({ ppmId: id, order: i, text: s.text.trim() })),
        });
      }
      return tx.ppm.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.description !== undefined && {
            description: data.description?.trim() || null,
          }),
        },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    });
  },

  async deactivate(id: string) {
    return prisma.ppm.update({ where: { id }, data: { status: "INACTIVE" } });
  },

  async activate(id: string) {
    return prisma.ppm.update({ where: { id }, data: { status: "ACTIVE" } });
  },

  /** Snapshot a PPM's steps onto a freshly-created ticket. */
  async snapshotOntoTicket(ppmId: string, ticketId: string) {
    const steps = await prisma.ppmStep.findMany({
      where: { ppmId },
      orderBy: { order: "asc" },
    });
    if (steps.length === 0) return;
    await prisma.ticketPpmStep.createMany({
      data: steps.map((s) => ({
        ticketId,
        order: s.order,
        text: s.text,
      })),
    });
  },

  async updateStepStatus(
    stepId: string,
    userId: string,
    data: { status: "PENDING" | "OK" | "NOT_OK" | "NA"; remarks?: string | null },
  ) {
    return prisma.ticketPpmStep.update({
      where: { id: stepId },
      data: {
        status: data.status,
        remarks: data.remarks === undefined ? undefined : data.remarks?.trim() || null,
        completedById: data.status === "PENDING" ? null : userId,
        completedAt: data.status === "PENDING" ? null : new Date(),
      },
    });
  },
};
