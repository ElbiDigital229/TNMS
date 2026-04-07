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
  /** Parse imagePath field — handles legacy single path, JSON array, or null */
  parseImagePaths(imagePath: string | null | undefined): string[] {
    if (!imagePath) return [];
    const trimmed = imagePath.trim();
    if (trimmed.startsWith("[")) {
      try {
        const arr = JSON.parse(trimmed);
        return Array.isArray(arr) ? arr.filter(Boolean) : [];
      } catch {
        return [];
      }
    }
    // Legacy: single path string
    return [trimmed];
  },

  /** Directly set imagePath (supports null to clear) */
  async setImagePath(id: string, imagePath: string | null) {
    return prisma.ticket.update({
      where: { id },
      data: { imagePath },
    });
  },

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
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    viewMode?: "all" | "assigned";
    userId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    // Build orderBy from sort params
    const allowedSortColumns = ["ticketNumber", "name", "priority", "status", "dueDate", "createdAt"];
    const sortCol = allowedSortColumns.includes(params.sortBy || "") ? params.sortBy! : "createdAt";
    const sortDir = params.sortOrder === "asc" ? "asc" : "desc";
    const orderBy = { [sortCol]: sortDir };

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
        orderBy,
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

    // Auto-assign: if department is set but no assignee, use the department head
    let effectiveAssigneeId = data.assignedToId;
    let autoAssigned = false;
    if (!effectiveAssigneeId && data.departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: data.departmentId },
        select: { headUserId: true },
      });
      if (dept?.headUserId) {
        // Verify head is still active
        const head = await prisma.user.findUnique({
          where: { id: dept.headUserId },
          select: { id: true, status: true },
        });
        if (head?.status === "ACTIVE") {
          effectiveAssigneeId = head.id;
          autoAssigned = true;
        }
      }
    }

    // Determine initial status: ASSIGNED if someone owns it, UNASSIGNED otherwise
    const initialStatus = effectiveAssigneeId ? "ASSIGNED" : "UNASSIGNED";

    const ticket = await prisma.ticket.create({
      data: {
        ...ticketData,
        assignedToId: effectiveAssigneeId || null,
        status: initialStatus as any,
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

    // Log auto-assignment activity if applicable
    if (autoAssigned && effectiveAssigneeId) {
      const mgr = await prisma.user.findUnique({ where: { id: effectiveAssigneeId }, select: { fullName: true, username: true } });
      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          action: "ASSIGNED",
          details: `Auto-assigned to department head ${mgr?.fullName || mgr?.username}`,
          performedById: data.createdById || null,
        },
      });
    }

    // Fire-and-forget notifications
    if (data.createdById) {
      notificationTrigger.onTicketCreated(ticket.id, data.createdById).catch(console.error);
    }

    // Notify the assignee if ticket is assigned on creation (manual or auto)
    if (effectiveAssigneeId && data.createdById) {
      notificationTrigger.onTicketAssigned(ticket.id, effectiveAssigneeId, data.createdById, null).catch(console.error);
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
        completedAt: status === "COMPLETED" ? new Date() : null,
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

      // Parse @mentions and notify mentioned users
      const mentionPattern = /@([A-Za-z\u00C0-\u024F]+(?: [A-Za-z\u00C0-\u024F]+)?)/g;
      const mentions: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = mentionPattern.exec(content)) !== null) {
        mentions.push(match[1]);
      }

      if (mentions.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: {
            status: "ACTIVE",
            OR: mentions.flatMap((name) => [
              { fullName: { equals: name, mode: "insensitive" as const } },
              { username: { equals: name, mode: "insensitive" as const } },
            ]),
          },
          select: { id: true },
        });

        if (mentionedUsers.length > 0) {
          notificationTrigger
            .onTicketMention(ticketId, mentionedUsers.map((u) => u.id), commenterId)
            .catch(console.error);
        }
      }
    }

    return comment;
  },

  async editComment(commentId: string, content: string, userId: string) {
    const comment = await prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new Error("Comment not found");
    if (comment.commenterId !== userId) throw new Error("You can only edit your own comments");

    const ageMs = Date.now() - new Date(comment.createdAt).getTime();
    if (ageMs > 15 * 60 * 1000) throw new Error("Comments can only be edited within 15 minutes");

    return prisma.ticketComment.update({
      where: { id: commentId },
      data: { content, editedAt: new Date() },
      include: { commenter: { select: { id: true, fullName: true, username: true } } },
    });
  },

  async deleteComment(commentId: string, userId: string) {
    const comment = await prisma.ticketComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new Error("Comment not found");
    if (comment.commenterId !== userId) throw new Error("You can only delete your own comments");

    const ageMs = Date.now() - new Date(comment.createdAt).getTime();
    if (ageMs > 15 * 60 * 1000) throw new Error("Comments can only be deleted within 15 minutes");

    await prisma.ticketComment.delete({ where: { id: commentId } });
    return { success: true };
  },

  async assign(ticketId: string, assigneeId: string, assignerId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { assignedToId: true },
    });
    if (!ticket) throw new Error("Ticket not found");

    // Auto-transition UNASSIGNED → ASSIGNED when assigning
    const updateData: any = { assignedToId: assigneeId };
    if (ticket.assignedToId === null || (ticket as any).status === "UNASSIGNED") {
      updateData.status = "ASSIGNED";
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
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

    // Set ticket status to BLOCKED
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: "BLOCKED" },
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
      select: { id: true, blockedById: true, previousStatus: true },
    });
    if (!activeBlock) throw new Error("No active block found");

    await prisma.ticketBlock.update({
      where: { id: activeBlock.id },
      data: { resolvedAt: new Date(), resolvedById, resolvedNote: resolvedNote || null },
    });

    // Restore previous status
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: activeBlock.previousStatus },
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

  async findRelated(ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        unitId: true,
        assets: { select: { assetId: true } },
      },
    });
    if (!ticket) return [];

    const assetIds = ticket.assets.map((a) => a.assetId);

    const where: any = {
      id: { not: ticketId },
      OR: [
        { unitId: ticket.unitId },
        ...(assetIds.length
          ? [{ assets: { some: { assetId: { in: assetIds } } } }]
          : []),
      ],
    };

    return prisma.ticket.findMany({
      where,
      select: {
        id: true,
        ticketNumber: true,
        name: true,
        status: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
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

  /**
   * Bulk-create tickets from CSV-like rows. Resolves names to IDs row-by-row,
   * returns per-row success/error so the caller can show a report.
   * Mirrors the create() flow: auto-assigns to dept head if assignee blank.
   */
  async bulkCreate(
    items: {
      title?: string;
      description?: string;
      property?: string;       // property code OR name
      unit?: string;           // unit name (within the resolved property)
      department?: string;     // department name
      category?: string;       // ticket category name
      taskType?: string;       // MAINTENANCE | INSPECT | COMPLAIN | TASK (case-insensitive, accepts inspection/complaint aliases)
      subTaskType?: string;    // REACTIVE | PREVENTIVE
      priority?: string;       // LOW | MEDIUM | HIGH | CRITICAL
      dueDate?: string;        // YYYY-MM-DD
      assigneeEmail?: string;  // optional
    }[],
    importerId: string
  ) {
    // ── Build lookup maps once ──
    const properties = await prisma.property.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true },
    });
    const propByCode = new Map(properties.map((p) => [p.code.toLowerCase(), p]));
    const propByName = new Map(properties.map((p) => [p.name.trim().toLowerCase(), p]));

    const units = await prisma.unit.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, code: true, propertyId: true },
    });
    const unitByPropAndName = new Map<string, { id: string }>();
    for (const u of units) {
      unitByPropAndName.set(`${u.propertyId}::${u.name.trim().toLowerCase()}`, { id: u.id });
      if (u.code) unitByPropAndName.set(`${u.propertyId}::${u.code.trim().toLowerCase()}`, { id: u.id });
    }

    const departments = await prisma.department.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, headUserId: true },
    });
    const deptByName = new Map(departments.map((d) => [d.name.trim().toLowerCase(), d]));

    const categories = await prisma.ticketCategory.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
    });
    const catByName = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c]));

    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, email: true, username: true, departmentId: true, status: true },
    });
    const userByEmail = new Map<string, { id: string; departmentId: string | null }>();
    for (const u of users) {
      if (u.email) userByEmail.set(u.email.trim().toLowerCase(), { id: u.id, departmentId: u.departmentId });
      userByEmail.set(u.username.trim().toLowerCase(), { id: u.id, departmentId: u.departmentId });
    }

    // ── Normalisers ──
    const taskTypeMap: Record<string, TaskType> = {
      maintenance: "MAINTENANCE",
      inspect: "INSPECT",
      inspection: "INSPECT",
      complain: "COMPLAIN",
      complaint: "COMPLAIN",
      task: "TASK",
    };
    const subTaskMap: Record<string, SubTaskType> = {
      reactive: "REACTIVE",
      preventive: "PREVENTIVE",
    };
    const priorityMap: Record<string, Priority> = {
      low: "LOW",
      medium: "MEDIUM",
      high: "HIGH",
      critical: "CRITICAL",
    };

    const results: { row: number; status: "success" | "error"; title: string; ticketNumber?: string; error?: string }[] = [];

    // Pre-fetch the highest existing ticket number once, then increment locally
    // (avoids 5000 round-trips to generateTicketNumber)
    const last = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: "desc" },
      select: { ticketNumber: true },
    });
    let nextNum = last ? parseInt(last.ticketNumber.slice(3), 10) + 1 : 1;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;
      const title = (item.title || "").trim();

      try {
        // Required text fields
        if (!title) {
          results.push({ row: rowNum, status: "error", title: "", error: "Title is required" });
          continue;
        }

        // Property
        const propKey = (item.property || "").trim().toLowerCase();
        if (!propKey) {
          results.push({ row: rowNum, status: "error", title, error: "Property is required" });
          continue;
        }
        const prop = propByCode.get(propKey) || propByName.get(propKey);
        if (!prop) {
          results.push({ row: rowNum, status: "error", title, error: `Property "${item.property}" not found` });
          continue;
        }

        // Unit (within that property)
        const unitKey = (item.unit || "").trim().toLowerCase();
        if (!unitKey) {
          results.push({ row: rowNum, status: "error", title, error: "Unit is required" });
          continue;
        }
        const unit = unitByPropAndName.get(`${prop.id}::${unitKey}`);
        if (!unit) {
          results.push({ row: rowNum, status: "error", title, error: `Unit "${item.unit}" not found in property "${prop.name}"` });
          continue;
        }

        // Department
        const deptKey = (item.department || "").trim().toLowerCase();
        if (!deptKey) {
          results.push({ row: rowNum, status: "error", title, error: "Department is required" });
          continue;
        }
        const dept = deptByName.get(deptKey);
        if (!dept) {
          results.push({ row: rowNum, status: "error", title, error: `Department "${item.department}" not found` });
          continue;
        }

        // Category
        const catKey = (item.category || "").trim().toLowerCase();
        if (!catKey) {
          results.push({ row: rowNum, status: "error", title, error: "Category is required" });
          continue;
        }
        const cat = catByName.get(catKey);
        if (!cat) {
          results.push({ row: rowNum, status: "error", title, error: `Category "${item.category}" not found` });
          continue;
        }

        // Task type
        const ttKey = (item.taskType || "").trim().toLowerCase();
        const taskType = taskTypeMap[ttKey];
        if (!taskType) {
          results.push({ row: rowNum, status: "error", title, error: `Task Type "${item.taskType}" invalid (use Maintenance/Inspection/Complaint/Task)` });
          continue;
        }

        // Sub task type — defaults to REACTIVE if blank
        const stKey = (item.subTaskType || "").trim().toLowerCase();
        const subTaskType: SubTaskType = stKey ? subTaskMap[stKey] : "REACTIVE";
        if (!subTaskType) {
          results.push({ row: rowNum, status: "error", title, error: `Sub Task Type "${item.subTaskType}" invalid (use Reactive/Preventive)` });
          continue;
        }

        // Priority
        const prKey = (item.priority || "").trim().toLowerCase();
        const priority = priorityMap[prKey];
        if (!priority) {
          results.push({ row: rowNum, status: "error", title, error: `Priority "${item.priority}" invalid (use Low/Medium/High/Critical)` });
          continue;
        }

        // Due date
        const dueRaw = (item.dueDate || "").trim();
        if (!dueRaw) {
          results.push({ row: rowNum, status: "error", title, error: "Due Date is required (YYYY-MM-DD)" });
          continue;
        }
        const dueDate = new Date(dueRaw);
        if (Number.isNaN(dueDate.getTime())) {
          results.push({ row: rowNum, status: "error", title, error: `Due Date "${item.dueDate}" is not a valid date` });
          continue;
        }

        // Optional assignee
        let assignedToId: string | null = null;
        let autoAssigned = false;
        const assigneeKey = (item.assigneeEmail || "").trim().toLowerCase();
        if (assigneeKey) {
          const u = userByEmail.get(assigneeKey);
          if (!u) {
            results.push({ row: rowNum, status: "error", title, error: `Assignee "${item.assigneeEmail}" not found` });
            continue;
          }
          assignedToId = u.id;
        } else if (dept.headUserId) {
          // Verify head is still active (we filtered users to ACTIVE above)
          if (users.some((u) => u.id === dept.headUserId)) {
            assignedToId = dept.headUserId;
            autoAssigned = true;
          }
        }

        const ticketNumber = `TKT${String(nextNum).padStart(4, "0")}`;
        nextNum++;

        const ticket = await prisma.ticket.create({
          data: {
            ticketNumber,
            name: title,
            description: (item.description || "").trim() || title,
            propertyId: prop.id,
            unitId: unit.id,
            departmentId: dept.id,
            categoryId: cat.id,
            taskType,
            subTaskType,
            priority,
            dueDate,
            assignedToId,
            status: assignedToId ? "ASSIGNED" : "UNASSIGNED",
            createdById: importerId,
          },
        });

        await prisma.ticketActivity.create({
          data: {
            ticketId: ticket.id,
            action: "CREATED",
            details: `Ticket ${ticketNumber} created via bulk import`,
            performedById: importerId,
          },
        });

        if (autoAssigned && assignedToId) {
          await prisma.ticketActivity.create({
            data: {
              ticketId: ticket.id,
              action: "ASSIGNED",
              details: `Auto-assigned to department head`,
              performedById: importerId,
            },
          });
        }

        results.push({ row: rowNum, status: "success", title, ticketNumber });
      } catch (err: any) {
        results.push({ row: rowNum, status: "error", title, error: err.message || "Unknown error" });
      }
    }

    return results;
  },
};
