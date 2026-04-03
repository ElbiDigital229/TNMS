import { prisma } from "../../config/db.js";
import type {
  TaskType,
  SubTaskType,
  Priority,
  TicketStatus,
  RecurringType,
} from "@prisma/client";
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
    assigneeId?: string;
    createdById?: string;
    createdFrom?: string;
    createdTo?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    blocked?: string;
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
    if (params.assigneeId) where.assignedToId = params.assigneeId;
    if (params.createdById) where.createdById = params.createdById;
    if (params.createdFrom || params.createdTo) {
      where.createdAt = {};
      if (params.createdFrom) where.createdAt.gte = new Date(params.createdFrom);
      if (params.createdTo) where.createdAt.lte = new Date(params.createdTo + "T23:59:59Z");
    }
    if (params.dueDateFrom || params.dueDateTo) {
      where.dueDate = {};
      if (params.dueDateFrom) where.dueDate.gte = new Date(params.dueDateFrom);
      if (params.dueDateTo) where.dueDate.lte = new Date(params.dueDateTo + "T23:59:59Z");
    }
    if (params.blocked === "yes") where.blocks = { some: { resolvedAt: null } };
    if (params.blocked === "no") where.blocks = { none: { resolvedAt: null } };
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
          department: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
          assignedTo: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
          assets: {
            include: { asset: { select: { id: true, name: true, code: true } } },
          },
          blocks: {
            where: { resolvedAt: null },
            take: 1,
            select: {
              blockingUser: { select: { fullName: true, username: true } },
              department: { select: { name: true } },
            },
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
        department: { select: { id: true, name: true } },
        assets: {
          include: { asset: { select: { id: true, name: true, code: true } } },
        },
        createdBy: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
        assignedTo: { select: { id: true, username: true, fullName: true, role: { select: { name: true } } } },
        comments: { orderBy: { createdAt: "desc" }, include: { commenter: { select: { id: true, fullName: true, username: true } } } },
        activities: {
          orderBy: { createdAt: "asc" },
          include: { performedBy: { select: { id: true, fullName: true, username: true } } },
        },
        blocks: {
          orderBy: { createdAt: "desc" },
          include: {
            blockedBy: { select: { id: true, fullName: true, username: true } },
            blockingUser: { select: { id: true, fullName: true, username: true } },
            resolvedBy: { select: { id: true, fullName: true, username: true } },
            department: { select: { id: true, name: true } },
          },
        },
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
    departmentId: string;
    assignedToId?: string;
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
        performedById: data.createdById || null,
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

    // Fetch old ticket for change tracking
    const oldTicket = await prisma.ticket.findUnique({
      where: { id },
      include: { assignedTo: { select: { fullName: true } }, category: { select: { name: true } } },
    });

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

    // Build specific change details
    const changes: string[] = [];
    if (oldTicket) {
      if (data.name !== undefined && data.name !== oldTicket.name) changes.push(`Name changed to "${data.name}"`);
      if (data.priority !== undefined && data.priority !== oldTicket.priority) changes.push(`Priority changed from ${oldTicket.priority} to ${data.priority}`);
      if (data.dueDate !== undefined) {
        const oldDate = oldTicket.dueDate ? oldTicket.dueDate.toISOString().split("T")[0] : "none";
        const newDate = new Date(data.dueDate).toISOString().split("T")[0];
        if (oldDate !== newDate) changes.push(`Due date changed from ${oldDate} to ${newDate}`);
      }
      // Note: status and assignedTo changes are tracked by their own methods
      if (data.categoryId !== undefined && data.categoryId !== oldTicket.categoryId) {
        const newCategory = data.categoryId ? await prisma.ticketCategory.findUnique({ where: { id: data.categoryId }, select: { name: true } }) : null;
        changes.push(`Category changed from ${oldTicket.category?.name || "none"} to ${newCategory?.name || "none"}`);
      }
      if (data.description !== undefined && data.description !== oldTicket.description) changes.push("Description updated");
      if (data.taskType !== undefined && data.taskType !== oldTicket.taskType) changes.push(`Task type changed from ${oldTicket.taskType} to ${data.taskType}`);
      if (data.subTaskType !== undefined && data.subTaskType !== oldTicket.subTaskType) changes.push(`Sub-task type changed from ${oldTicket.subTaskType || "none"} to ${data.subTaskType || "none"}`);
    }
    const details = changes.length > 0 ? changes.join(", ") : "Ticket details updated";

    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        action: "UPDATED",
        details,
        performedById: editorUserId || null,
      },
    });

    // Fire-and-forget notification (#9 ticket edited)
    if (editorUserId) {
      notificationTrigger.onTicketEdited(id, editorUserId).catch(console.error);
    }

    return ticket;
  },

  async updateStatus(id: string, status: TicketStatus, updatedByUserId?: string) {
    // If completing a blocked ticket, auto-resolve the active block first
    if (status === "COMPLETED") {
      const activeBlock = await prisma.ticketBlock.findFirst({
        where: { ticketId: id, resolvedAt: null },
        select: { id: true, blockedById: true },
      });
      if (activeBlock) {
        await prisma.ticketBlock.update({
          where: { id: activeBlock.id },
          data: { resolvedAt: new Date(), resolvedById: updatedByUserId || null, resolvedNote: "Auto-resolved: ticket marked as completed" },
        });
        await prisma.ticketActivity.create({
          data: { ticketId: id, action: "UNBLOCKED", details: "Auto-resolved: ticket marked as completed", performedById: updatedByUserId || null },
        });
        if (updatedByUserId) {
          notificationTrigger.onTicketUnblocked(id, updatedByUserId, activeBlock.blockedById).catch(console.error);
        }
      }
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : (status === "OPEN" || status === "IN_PROGRESS" ? null : undefined),
      },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId: id,
        action: "STATUS_CHANGED",
        details: `Status changed to ${status}`,
        performedById: updatedByUserId || null,
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
      data: { ticketId, content, commenterId: commenterId || null },
    });

    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "COMMENT_ADDED",
        details: "New comment added",
        performedById: commenterId || null,
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
      select: { assignedToId: true },
    });
    if (!ticket) throw new Error("Ticket not found");

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
        performedById: assignerId,
      },
    });

    notificationTrigger
      .onTicketAssigned(ticketId, assigneeId, assignerId, ticket.assignedToId)
      .catch(console.error);

    return updated;
  },

  async block(ticketId: string, data: { blockingUserId?: string; departmentId: string; reason: string }, blockedById: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true, status: true } });
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.status === "COMPLETED") throw new Error("Cannot block a completed ticket");

    const existingBlock = await prisma.ticketBlock.findFirst({ where: { ticketId, resolvedAt: null } });
    if (existingBlock) throw new Error("Ticket already has an active block");

    await prisma.ticketBlock.create({
      data: {
        ticketId,
        blockedById,
        blockingUserId: data.blockingUserId || null,
        departmentId: data.departmentId,
        reason: data.reason,
        previousStatus: ticket.status,
      },
    });

    // Resolve display names for activity log
    const [blockedByUser, blockingUserRecord, deptRecord] = await Promise.all([
      prisma.user.findUnique({ where: { id: blockedById }, select: { fullName: true, username: true } }),
      data.blockingUserId ? prisma.user.findUnique({ where: { id: data.blockingUserId }, select: { fullName: true, username: true } }) : null,
      prisma.department.findUnique({ where: { id: data.departmentId }, select: { name: true } }),
    ]);
    const blockedByName = blockedByUser?.fullName || blockedByUser?.username || "Unknown";
    const blockingTarget = blockingUserRecord
      ? `${blockingUserRecord.fullName || blockingUserRecord.username} (${deptRecord?.name})`
      : deptRecord?.name || "Unknown department";

    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "BLOCKED",
        details: `${blockedByName} blocked — waiting on ${blockingTarget}. Reason: ${data.reason}`,
        performedById: blockedById,
      },
    });

    if (data.blockingUserId) {
      notificationTrigger.onTicketBlocked(ticketId, blockedById, data.blockingUserId, data.reason).catch(console.error);
    }
  },

  async unblock(ticketId: string, resolvedNote: string | undefined, resolvedById: string) {
    const activeBlock = await prisma.ticketBlock.findFirst({
      where: { ticketId, resolvedAt: null },
      select: { id: true, blockedById: true },
    });
    if (!activeBlock) throw new Error("No active block found");

    await prisma.ticketBlock.update({
      where: { id: activeBlock.id },
      data: { resolvedAt: new Date(), resolvedById, resolvedNote: resolvedNote || null },
    });

    const resolvedByUser = await prisma.user.findUnique({ where: { id: resolvedById }, select: { fullName: true, username: true } });
    const resolvedByName = resolvedByUser?.fullName || resolvedByUser?.username || "Unknown";

    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "UNBLOCKED",
        details: resolvedNote ? `${resolvedByName} unblocked: ${resolvedNote}` : `${resolvedByName} resolved the block`,
        performedById: resolvedById,
      },
    });

    notificationTrigger.onTicketUnblocked(ticketId, resolvedById, activeBlock.blockedById).catch(console.error);
  },

  async getAssignableUsers(ticketId: string, _assignerId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { departmentId: true },
    });
    if (!ticket) throw new Error("Ticket not found");
    return prisma.user.findMany({
      where: {
        departmentId: ticket.departmentId,
        status: "ACTIVE",
        role: { name: { in: ["Manager", "Supervisor", "Technician"] } },
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { fullName: "asc" },
    });
  },
};
