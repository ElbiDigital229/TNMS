import { prisma } from "../../config/db.js";
import type {
  TaskType,
  SubTaskType,
  Priority,
  TicketStatus,
} from "@prisma/client";
import { notificationTrigger, fireAndForgetNotify } from "../../services/notificationTrigger.service.js";

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
    // Must include hidden (legacy + soft-deleted) tickets so the next number
    // never collides with an existing ticket number.
    const last = await prisma.ticket.findFirst({
      where: { __includeHidden: true } as any,
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
    overdue?: string;
    /** "1"/"true" → only legacy tickets. Anything else → only non-legacy (default). */
    legacy?: string;
    /** "1"/"true" → only soft-deleted tickets. Anything else → only non-deleted (default). */
    deleted?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    viewMode?: "all" | "assigned";
    userId?: string;
    /** When set, also include tickets where this user is an active blocker
     *  (bypassing the propertyIds RBAC scope). */
    includeBlockerTicketsForUserId?: string;
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
    // Helper: accept "VAL" or "VAL1,VAL2" → string[] for `in` queries
    const toList = (v: string | undefined) =>
      v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const statusList = toList(params.status);
    const priorityList = toList(params.priority);
    const taskTypeList = toList(params.taskType);
    const propIdList = toList(params.propertyId);
    if (statusList.length === 1) where.status = statusList[0];
    else if (statusList.length > 1) where.status = { in: statusList };
    if (priorityList.length === 1) where.priority = priorityList[0];
    else if (priorityList.length > 1) where.priority = { in: priorityList };
    if (taskTypeList.length === 1) where.taskType = taskTypeList[0];
    else if (taskTypeList.length > 1) where.taskType = { in: taskTypeList };
    if (propIdList.length === 1) where.propertyId = propIdList[0];
    else if (propIdList.length > 1) where.propertyId = { in: propIdList };
    // RBAC scope intersection
    if (params.propertyIds) {
      if (where.propertyId) {
        // intersect: caller's selection ∩ allowed scope
        const callerIds = Array.isArray(where.propertyId)
          ? where.propertyId
          : typeof where.propertyId === "object"
          ? where.propertyId.in
          : [where.propertyId];
        const allowed = params.propertyIds;
        const intersection = callerIds.filter((id: string) => allowed.includes(id));
        where.propertyId = intersection.length === 1 ? intersection[0] : { in: intersection };
      } else {
        where.propertyId = { in: params.propertyIds };
      }
    }
    // Allow blocker tickets to bypass the property scope: caller can always
    // see tickets where they are actively blocking, even if the ticket lives
    // on a property they aren't directly assigned to. We move the property
    // scope into an AND[] so it doesn't collide with the search OR.
    if (params.includeBlockerTicketsForUserId && where.propertyId) {
      const propertyScope = where.propertyId;
      delete where.propertyId;
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { propertyId: propertyScope },
            {
              blocks: {
                some: { blockingUserId: params.includeBlockerTicketsForUserId, resolvedAt: null },
              },
            },
          ],
        },
      ];
    }
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
    if (params.overdue === "1" || params.overdue === "true") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      where.status = { not: "COMPLETED" };
      where.dueDate = { ...(where.dueDate || {}), lt: startOfToday };
    }
    if (params.viewMode === "assigned" && params.userId) {
      where.assignedToId = params.userId;
    }
    // Hidden-ticket views (opt-in). The Prisma extension excludes legacy +
    // soft-deleted by default; setting these explicitly overrides that.
    if (params.legacy === "1" || params.legacy === "true") {
      where.legacy = true;
    }
    if (params.deleted === "1" || params.deleted === "true") {
      where.deletedAt = { not: null };
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
    unitId?: string;
    dueDate?: Date;
    taskType?: TaskType;
    subTaskType?: SubTaskType;
    categoryId?: string;
    departmentId?: string;
    assignedToId?: string;
    priority?: Priority;
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
      fireAndForgetNotify("onTicketCreated", () =>
        notificationTrigger.onTicketCreated(ticket.id, data.createdById!),
      );
    }

    // Notify the assignee if ticket is assigned on creation (manual or auto)
    if (effectiveAssigneeId && data.createdById) {
      fireAndForgetNotify("onTicketAssigned", () =>
        notificationTrigger.onTicketAssigned(ticket.id, effectiveAssigneeId, data.createdById!, null),
      );
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
      departmentId?: string;
      priority?: Priority;
      imagePath?: string;
      assetIds?: string[];
    },
    editorUserId?: string
  ) {
    const { assetIds, ...ticketData } = data;

    // Fetch old ticket for change tracking
    const oldTicket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, fullName: true, departmentId: true } },
        category: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    // If department changes and the current assignee no longer belongs to the
    // new department, clear the assignment so the ticket isn't stuck with a
    // mismatched person.
    if (
      data.departmentId !== undefined &&
      oldTicket &&
      data.departmentId !== oldTicket.departmentId &&
      oldTicket.assignedTo &&
      oldTicket.assignedTo.departmentId !== data.departmentId
    ) {
      (ticketData as any).assignedToId = null;
    }

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
      if (data.name !== undefined && data.name !== oldTicket.name) changes.push(`Name changed from "${oldTicket.name}" to "${data.name}"`);
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
      if (data.description !== undefined && data.description !== oldTicket.description) {
        const oldDesc = oldTicket.description ? (oldTicket.description.length > 60 ? oldTicket.description.slice(0, 60) + "..." : oldTicket.description) : "empty";
        const newDesc = data.description ? (data.description.length > 60 ? data.description.slice(0, 60) + "..." : data.description) : "empty";
        changes.push(`Description changed from "${oldDesc}" to "${newDesc}"`);
      }
      if (data.taskType !== undefined && data.taskType !== oldTicket.taskType) changes.push(`Task type changed from ${oldTicket.taskType} to ${data.taskType}`);
      if (data.subTaskType !== undefined && data.subTaskType !== oldTicket.subTaskType) changes.push(`Sub-task type changed from ${oldTicket.subTaskType || "none"} to ${data.subTaskType || "none"}`);
      if (data.departmentId !== undefined && data.departmentId !== oldTicket.departmentId) {
        const newDept = data.departmentId ? await prisma.department.findUnique({ where: { id: data.departmentId }, select: { name: true } }) : null;
        changes.push(`Department changed from ${oldTicket.department?.name || "none"} to ${newDept?.name || "none"}`);
      }
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
      fireAndForgetNotify("onTicketEdited", () =>
        notificationTrigger.onTicketEdited(id, editorUserId),
      );
    }

    return ticket;
  },

  async updateStatus(id: string, status: TicketStatus, updatedByUserId?: string) {
    // Fetch old status for change tracking
    const oldTicket = await prisma.ticket.findUnique({ where: { id }, select: { status: true } });

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
          fireAndForgetNotify("onTicketUnblocked", () =>
            notificationTrigger.onTicketUnblocked(id, updatedByUserId, activeBlock.blockedById),
          );
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
        details: `Status changed from ${oldTicket?.status || "unknown"} to ${status}`,
        performedById: updatedByUserId || null,
      },
    });

    // Fire-and-forget notification
    if (updatedByUserId) {
      fireAndForgetNotify("onTicketStatusChanged", () =>
        notificationTrigger.onTicketStatusChanged(id, status, updatedByUserId),
      );
    }

    return ticket;
  },

  async addComment(ticketId: string, content: string, commenterId?: string) {
    const comment = await prisma.ticketComment.create({
      data: { ticketId, content, commenterId: commenterId || null },
    });

    const commentPreview = content.length > 120 ? content.slice(0, 120) + "..." : content;
    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "COMMENT_ADDED",
        details: `Comment added: "${commentPreview}"`,
        performedById: commenterId || null,
      },
    });

    // Fire-and-forget notification
    if (commenterId) {
      fireAndForgetNotify("onTicketCommentAdded", () =>
        notificationTrigger.onTicketCommentAdded(ticketId, commenterId),
      );

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
          fireAndForgetNotify("onTicketMention", () =>
            notificationTrigger.onTicketMention(
              ticketId,
              mentionedUsers.map((u) => u.id),
              commenterId,
            ),
          );
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

    const updated = await prisma.ticketComment.update({
      where: { id: commentId },
      data: { content, editedAt: new Date() },
      include: { commenter: { select: { id: true, fullName: true, username: true } } },
    });

    const oldPreview = comment.content.length > 80 ? comment.content.slice(0, 80) + "..." : comment.content;
    const newPreview = content.length > 80 ? content.slice(0, 80) + "..." : content;
    await prisma.ticketActivity.create({
      data: {
        ticketId: comment.ticketId,
        action: "COMMENT_EDITED",
        details: `Comment changed from "${oldPreview}" to "${newPreview}"`,
        performedById: userId,
      },
    });

    return updated;
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

    fireAndForgetNotify("onTicketAssigned", () =>
      notificationTrigger.onTicketAssigned(ticketId, assigneeId, assignerId, ticket.assignedToId),
    );

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
      fireAndForgetNotify("onTicketBlocked", () =>
        notificationTrigger.onTicketBlocked(ticketId, blockedById, data.blockingUserId!, data.reason),
      );
    }
  },

  /** Soft-delete (archive). Sets deletedAt = now() so the row is hidden from
   *  default queries but kept in the DB and can be restored. */
  async softDelete(ticketId: string, userId?: string) {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { deletedAt: new Date() },
    });
    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "DELETED",
        details: "Ticket archived (soft-deleted)",
        performedById: userId || null,
      },
    });
    return ticket;
  },

  /** Restore a soft-deleted ticket. */
  async restore(ticketId: string, userId?: string) {
    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { deletedAt: null },
    });
    await prisma.ticketActivity.create({
      data: {
        ticketId,
        action: "RESTORED",
        details: "Ticket restored from archive",
        performedById: userId || null,
      },
    });
    return ticket;
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

    fireAndForgetNotify("onTicketUnblocked", () =>
      notificationTrigger.onTicketUnblocked(ticketId, resolvedById, activeBlock.blockedById),
    );
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
      where: { __includeHidden: true } as any,
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

        // Description (required)
        const description = (item.description || "").trim();
        if (!description) {
          results.push({ row: rowNum, status: "error", title, error: "Description is required" });
          continue;
        }

        // Unit (optional — must belong to the property if provided)
        let unitId: string | null = null;
        const unitKey = (item.unit || "").trim().toLowerCase();
        if (unitKey) {
          const unit = unitByPropAndName.get(`${prop.id}::${unitKey}`);
          if (!unit) {
            results.push({ row: rowNum, status: "error", title, error: `Unit "${item.unit}" not found in property "${prop.name}"` });
            continue;
          }
          unitId = unit.id;
        }

        // Department (optional)
        let dept: { id: string; headUserId: string | null } | undefined;
        const deptKey = (item.department || "").trim().toLowerCase();
        if (deptKey) {
          dept = deptByName.get(deptKey);
          if (!dept) {
            results.push({ row: rowNum, status: "error", title, error: `Department "${item.department}" not found` });
            continue;
          }
        }

        // Category (optional)
        let categoryId: string | null = null;
        const catKey = (item.category || "").trim().toLowerCase();
        if (catKey) {
          const cat = catByName.get(catKey);
          if (!cat) {
            results.push({ row: rowNum, status: "error", title, error: `Category "${item.category}" not found` });
            continue;
          }
          categoryId = cat.id;
        }

        // Task type — defaults to TASK
        const ttKey = (item.taskType || "").trim().toLowerCase();
        let taskType: TaskType = "TASK";
        if (ttKey) {
          const mapped = taskTypeMap[ttKey];
          if (!mapped) {
            results.push({ row: rowNum, status: "error", title, error: `Task Type "${item.taskType}" invalid (use Maintenance/Inspection/Complaint/Task)` });
            continue;
          }
          taskType = mapped;
        }

        // Sub task type — defaults to REACTIVE
        const stKey = (item.subTaskType || "").trim().toLowerCase();
        let subTaskType: SubTaskType = "REACTIVE";
        if (stKey) {
          const mapped = subTaskMap[stKey];
          if (!mapped) {
            results.push({ row: rowNum, status: "error", title, error: `Sub Task Type "${item.subTaskType}" invalid (use Reactive/Preventive)` });
            continue;
          }
          subTaskType = mapped;
        }

        // Priority — defaults to MEDIUM
        const prKey = (item.priority || "").trim().toLowerCase();
        let priority: Priority = "MEDIUM";
        if (prKey) {
          const mapped = priorityMap[prKey];
          if (!mapped) {
            results.push({ row: rowNum, status: "error", title, error: `Priority "${item.priority}" invalid (use Low/Medium/High/Critical)` });
            continue;
          }
          priority = mapped;
        }

        // Due date (optional)
        let dueDate: Date | null = null;
        const dueRaw = (item.dueDate || "").trim();
        if (dueRaw) {
          const parsed = new Date(dueRaw);
          if (Number.isNaN(parsed.getTime())) {
            results.push({ row: rowNum, status: "error", title, error: `Due Date "${item.dueDate}" is not a valid date` });
            continue;
          }
          dueDate = parsed;
        }

        // Optional assignee — falls back to dept head if dept set
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
        } else if (dept?.headUserId) {
          // Verify head is still active (we filtered users to ACTIVE above)
          if (users.some((u) => u.id === dept!.headUserId)) {
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
            description,
            propertyId: prop.id,
            unitId,
            departmentId: dept?.id ?? null,
            categoryId,
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
