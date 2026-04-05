import { prisma } from "../../config/db.js";
import { rbacService } from "../../services/rbac.service.js";
import { ticketService } from "../ticket/ticket.service.js";

function computeNextRun(frequency: string, dayOfWeek?: number | null, dayOfMonth?: number | null, monthOfYear?: number | null, fromDate?: Date): Date {
  const now = fromDate || new Date();
  const next = new Date(now);

  switch (frequency) {
    case "DAILY":
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0); // 8 AM
      break;
    case "WEEKLY": {
      // Next occurrence of dayOfWeek (0=Sun..6=Sat)
      const targetDay = dayOfWeek ?? 1; // default Monday
      let daysUntil = targetDay - now.getDay();
      if (daysUntil <= 0) daysUntil += 7;
      next.setDate(next.getDate() + daysUntil);
      next.setHours(8, 0, 0, 0);
      break;
    }
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(dayOfMonth ?? 1, 28)); // safe day
      next.setHours(8, 0, 0, 0);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      next.setDate(Math.min(dayOfMonth ?? 1, 28));
      next.setHours(8, 0, 0, 0);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      if (monthOfYear) next.setMonth(monthOfYear - 1);
      next.setDate(Math.min(dayOfMonth ?? 1, 28));
      next.setHours(8, 0, 0, 0);
      break;
  }
  return next;
}

export const ticketScheduleService = {
  async findAll(params: {
    page?: number;
    limit?: number;
    propertyId?: string;
    isActive?: boolean;
    userId: string;
    isSuperAdmin: boolean;
    allProperties: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.propertyId) where.propertyId = params.propertyId;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    // Property scoping
    if (!params.isSuperAdmin && !params.allProperties) {
      const propertyIds = await rbacService.getUserPropertyIds(params.userId);
      if (propertyIds !== "all") {
        where.propertyId = { in: propertyIds as string[] };
      }
    }

    const [data, total] = await Promise.all([
      prisma.ticketSchedule.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, fullName: true, username: true } },
          createdBy: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { nextRunAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.ticketSchedule.count({ where }),
    ]);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async findById(id: string) {
    return prisma.ticketSchedule.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true, username: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  },

  async create(data: {
    name: string;
    description?: string;
    propertyId: string;
    unitId?: string;
    categoryId?: string;
    departmentId?: string;
    assignedToId?: string;
    priority?: string;
    taskType: string;
    subTaskType?: string;
    frequency: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    monthOfYear?: number;
    createdById: string;
  }) {
    const nextRunAt = computeNextRun(data.frequency, data.dayOfWeek, data.dayOfMonth, data.monthOfYear);

    return prisma.ticketSchedule.create({
      data: {
        name: data.name,
        description: data.description,
        propertyId: data.propertyId,
        unitId: data.unitId || undefined,
        categoryId: data.categoryId || undefined,
        departmentId: data.departmentId || undefined,
        assignedToId: data.assignedToId || undefined,
        priority: (data.priority as any) || "MEDIUM",
        taskType: data.taskType as any,
        subTaskType: (data.subTaskType as any) || "PREVENTIVE",
        frequency: data.frequency as any,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        monthOfYear: data.monthOfYear,
        nextRunAt,
        createdById: data.createdById,
      },
      include: {
        property: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true, username: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  },

  async update(id: string, data: {
    name?: string;
    description?: string;
    propertyId?: string;
    unitId?: string | null;
    categoryId?: string | null;
    departmentId?: string | null;
    assignedToId?: string | null;
    priority?: string;
    taskType?: string;
    subTaskType?: string;
    frequency?: string;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
    monthOfYear?: number | null;
    isActive?: boolean;
  }) {
    const existing = await prisma.ticketSchedule.findUniqueOrThrow({ where: { id } });

    const frequency = data.frequency || existing.frequency;
    const dayOfWeek = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;
    const dayOfMonth = data.dayOfMonth !== undefined ? data.dayOfMonth : existing.dayOfMonth;
    const monthOfYear = data.monthOfYear !== undefined ? data.monthOfYear : existing.monthOfYear;

    // Recompute nextRunAt if frequency or schedule params changed
    let nextRunAt = existing.nextRunAt;
    if (data.frequency || data.dayOfWeek !== undefined || data.dayOfMonth !== undefined || data.monthOfYear !== undefined) {
      nextRunAt = computeNextRun(frequency, dayOfWeek, dayOfMonth, monthOfYear);
    }

    const updateData: any = { nextRunAt };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.propertyId !== undefined) updateData.propertyId = data.propertyId;
    if (data.unitId !== undefined) updateData.unitId = data.unitId;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.taskType !== undefined) updateData.taskType = data.taskType;
    if (data.subTaskType !== undefined) updateData.subTaskType = data.subTaskType;
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.dayOfMonth !== undefined) updateData.dayOfMonth = data.dayOfMonth;
    if (data.monthOfYear !== undefined) updateData.monthOfYear = data.monthOfYear;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.ticketSchedule.update({
      where: { id },
      data: updateData,
      include: {
        property: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, fullName: true, username: true } },
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    });
  },

  async delete(id: string) {
    return prisma.ticketSchedule.delete({ where: { id } });
  },

  async toggle(id: string) {
    const existing = await prisma.ticketSchedule.findUniqueOrThrow({ where: { id } });
    return prisma.ticketSchedule.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  },

  // Called by cron job to process due schedules
  async processDueSchedules() {
    const now = new Date();
    const dueSchedules = await prisma.ticketSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
    });

    let created = 0;
    let errors = 0;

    for (const schedule of dueSchedules) {
      try {
        // Calculate due date: next occurrence after creation
        const dueDate = computeNextRun(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth, schedule.monthOfYear);

        await ticketService.create({
          name: schedule.name,
          description: schedule.description || `Auto-generated from scheduled template: ${schedule.name}`,
          propertyId: schedule.propertyId,
          unitId: schedule.unitId || "",
          categoryId: schedule.categoryId || "",
          departmentId: schedule.departmentId || "",
          assignedToId: schedule.assignedToId || undefined,
          priority: schedule.priority as any,
          taskType: schedule.taskType as any,
          subTaskType: schedule.subTaskType as any,
          dueDate,
          createdById: schedule.createdById,
        });

        // Update schedule: set lastRunAt and compute next run
        const nextRunAt = computeNextRun(schedule.frequency, schedule.dayOfWeek, schedule.dayOfMonth, schedule.monthOfYear);
        await prisma.ticketSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt },
        });

        created++;
      } catch (err) {
        console.error(`Failed to create ticket from schedule ${schedule.id}:`, err);
        errors++;
      }
    }

    if (created > 0 || errors > 0) {
      console.log(`[TicketScheduler] Processed ${dueSchedules.length} due schedules: ${created} created, ${errors} errors`);
    }
    return { processed: dueSchedules.length, created, errors };
  },
};
