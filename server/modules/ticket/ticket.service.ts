import { prisma } from "../../config/db.js";
import type {
  TaskType,
  SubTaskType,
  Priority,
  TicketStatus,
  RecurringType,
} from "@prisma/client";
import { rbacService } from "../../services/rbac.service.js";
import { notificationTrigger } from "../../services/notificationTrigger.service.js";

export const ticketService = {
  async generateTicketNumber(): Promise<string> {
    const last = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: "desc" },
      select: { ticketNumber: true },
    });

    let nextNum = 1;
    if (last) {
      const numPart = parseInt(last.ticketNumber.slice(3), 10);
      nextNum = numPart + 1;
    }

    return `TKT${String(nextNum).padStart(4, "0")}`;
  },

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: TicketStatus;
    priority?: Priority;
    taskType?: TaskType;
    propertyId?: string;
    propertyIds?: string[];
    viewMode?: "all" | "assigned";
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { ticketNumber: { contains: params.search, mode: "insensitive" } },
      ];
    }
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.taskType) where.taskType = params.taskType;
    if (params.propertyId) where.propertyId = params.propertyId;
    if (params.propertyIds) where.propertyId = { in: params.propertyIds };
    if (params.viewMode === "assigned" && params.userId) {
      where.assignedToId = params.userId;
    }

    const [data, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          property: { select: { id: true, name: true, code: true } },
          unit: { select: { id: true, name: true, code: true } },
          category: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
          assignedTo: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
          assets: {
            include: { asset: { select: { id: true, name: true, code: true } } },
          },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
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
    return prisma.ticket.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true, code: true } },
        unit: {
          select: {
            id: true,
            name: true,
            code: true,
            floor: { select: { id: true, name: true } },
          },
        },
        category: { select: { id: true, name: true } },
        assets: {
          include: { asset: { select: { id: true, name: true, code: true } } },
        },
        createdBy: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
        assignedTo: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
        comments: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" } },
      },
    });
  },

  async create(data: {
    name: string;
    description: string;
    propertyId: string;
    unitId: string;
    dueDate: Date;
    taskType: TaskType;
    subTaskType: SubTaskType;
    categoryId: string;
    priority: Priority;
    isRecurring?: boolean;
    recurringType?: RecurringType;
    recurringDay?: number;
    recurringDueDays?: number;
    imagePath?: string;
    assetIds?: string[];
    createdById?: string;
  }) {
    const ticketNumber = await this.generateTicketNumber();
    const { assetIds, ...ticketData } = data;

    const ticket = await prisma.ticket.create({
      data: {
        ...ticketData,
        ticketNumber,
        assets: assetIds?.length
          ? {
              create: assetIds.map((assetId) => ({ assetId })),
            }
          : undefined,
      },
      include: {
        property: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        assets: {
          include: { asset: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    // Log activity
    await prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        action: "CREATED",
        details: `Ticket ${ticketNumber} created`,
      },
    });

    // Fire-and-forget notification
    if (data.createdById) {
      notificationTrigger.onTicketCreated(ticket.id, data.createdById).catch(console.error);
    }

    return ticket;
  },

  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      unitId?: string;
      dueDate?: Date;
      taskType?: TaskType;
      subTaskType?: SubTaskType;
      categoryId?: string;
      priority?: Priority;
      isRecurring?: boolean;
      recurringType?: RecurringType | null;
      recurringDay?: number | null;
      recurringDueDays?: number | null;
      imagePath?: string;
      assetIds?: string[];
    },
    editorUserId?: string
  ) {
    const { assetIds, ...ticketData } = data;

    // Update assets if provided
    if (assetIds !== undefined) {
      await prisma.ticketAsset.deleteMany({ where: { ticketId: id } });
      if (assetIds.length > 0) {
        await prisma.ticketAsset.createMany({
          data: assetIds.map((assetId) => ({ ticketId: id, assetId })),
        });
      }
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: ticketData,
      include: {
        property: { select: { id: true, name: true, code: true } },
        unit: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        assets: {
          include: { asset: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        action: "UPDATED",
        details: "Ticket details updated",
      },
    });

    // Fire-and-forget notification (#9 ticket edited)
    if (editorUserId) {
      notificationTrigger.onTicketEdited(id, editorUserId).catch(console.error);
    }

    return ticket;
  },

  async updateStatus(id: string, status: TicketStatus, updatedByUserId?: string) {
    const ticket = await prisma.ticket.update({
      where: { id },
      data: { status },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        action: "STATUS_CHANGED",
        details: `Status changed to ${status}`,
      },
    });

    // Fire-and-forget notification
    if (updatedByUserId) {
      notificationTrigger.onTicketStatusChanged(id, status, updatedByUserId).catch(console.error);
    }

    return ticket;
  },

  async addComment(ticketId: string, content: string, commenterId?: string) {
    const comment = await prisma.ticketComment.create({
      data: { ticketId, content },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "COMMENT_ADDED",
        details: "New comment added",
      },
    });

    // Fire-and-forget notification
    if (commenterId) {
      notificationTrigger.onTicketCommentAdded(ticketId, commenterId).catch(console.error);
    }

    return comment;
  },

  async assign(ticketId: string, assigneeId: string, assignerId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { propertyId: true, assignedToId: true },
    });

    if (!ticket) throw new Error("Ticket not found");

    const check = await rbacService.canAssignTo(assignerId, assigneeId, ticket.propertyId);
    if (!check.allowed) {
      throw new Error(check.reason || "Assignment not allowed");
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedToId: assigneeId },
      include: {
        assignedTo: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
      },
    });

    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { fullName: true, username: true },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "ASSIGNED",
        details: `Assigned to ${assignee?.fullName || assignee?.username}`,
      },
    });

    // Fire-and-forget notification (includes #8 reassigned-away if previous assignee existed)
    notificationTrigger
      .onTicketAssigned(ticketId, assigneeId, assignerId, ticket.assignedToId)
      .catch(console.error);

    return updated;
  },

  async getAssignableUsers(ticketId: string, assignerId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { propertyId: true },
    });

    if (!ticket) throw new Error("Ticket not found");

    return rbacService.getAssignableUsers(assignerId, ticket.propertyId);
  },
};
