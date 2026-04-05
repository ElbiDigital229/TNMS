import type { Request, Response } from "express";
import { ticketService } from "./ticket.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import { rbacService } from "../../services/rbac.service.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const ticketController = {
  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, search, status, priority, taskType, propertyId, assigneeId, createdById, createdFrom, createdTo, dueDateFrom, dueDateTo, blocked, sortBy, sortOrder } =
        req.query;

      // Determine view mode based on permissions
      const hasViewAll = req.user!.isSuperAdmin || req.user!.permissions.includes(PERMISSIONS.TICKETS.VIEW_ALL);
      const viewMode = hasViewAll ? "all" as const : "assigned" as const;

      // Get property scope
      const userPropertyIds = await rbacService.getUserPropertyIds(req.user!.id);

      const result = await ticketService.findAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        status: status as any,
        priority: priority as any,
        taskType: taskType as any,
        propertyId: propertyId as string,
        propertyIds: userPropertyIds === "all" ? undefined : userPropertyIds,
        assigneeId: assigneeId as string,
        createdById: createdById as string,
        createdFrom: createdFrom as string,
        createdTo: createdTo as string,
        dueDateFrom: dueDateFrom as string,
        dueDateTo: dueDateTo as string,
        blocked: blocked as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
        viewMode,
        userId: req.user!.id,
      });
      // Flatten blocks[0] → activeBlock for the list
      const mapped = {
        ...result,
        data: result.data.map((t: any) => ({
          ...t,
          activeBlock: t.blocks?.[0] ?? null,
          blocks: undefined,
        })),
      };
      sendSuccess(res, mapped);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const ticket = await ticketService.findById(req.params.id);
      if (!ticket) return sendError(res, "Ticket not found", 404);

      const u = req.user!;
      const hasViewAll = u.isSuperAdmin || u.permissions.includes(PERMISSIONS.TICKETS.VIEW_ALL);
      const hasViewAssigned = u.permissions.includes(PERMISSIONS.TICKETS.VIEW_ASSIGNED);
      const isAssignee = ticket.assignedToId === u.id;
      const isCreator = ticket.createdById === u.id;
      const isActiveBlocker = (ticket as any).blocks?.some(
        (b: any) => b.blockingUserId === u.id && !b.resolvedAt
      );

      if (!hasViewAll && !(hasViewAssigned && (isAssignee || isCreator)) && !isActiveBlocker) {
        return sendError(res, "Access denied", 403);
      }

      sendSuccess(res, ticket);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        propertyId,
        unitId,
        dueDate,
        taskType,
        subTaskType,
        categoryId,
        departmentId,
        assignedToId,
        priority,
        isRecurring,
        recurringType,
        recurringDay,
        recurringDueDays,
        assetIds,
      } = req.body;

      if (!name || !description || !propertyId || !unitId || !dueDate || !taskType || !subTaskType || !departmentId || !priority || !categoryId) {
        return sendError(res, "Missing required fields (including category)", 400);
      }

      const imagePath = req.file ? `uploads/${req.file.filename}` : undefined;

      const ticket = await ticketService.create({
        name,
        description,
        propertyId,
        unitId,
        dueDate: new Date(dueDate),
        taskType,
        subTaskType,
        categoryId,
        departmentId,
        assignedToId: assignedToId || undefined,
        priority,
        isRecurring: isRecurring === "true" || isRecurring === true,
        recurringType: recurringType || undefined,
        recurringDay: recurringDay ? parseInt(recurringDay) : undefined,
        recurringDueDays: recurringDueDays
          ? parseInt(recurringDueDays)
          : undefined,
        imagePath,
        assetIds: assetIds
          ? typeof assetIds === "string"
            ? JSON.parse(assetIds)
            : assetIds
          : undefined,
        createdById: req.user?.id,
      });

      sendSuccess(res, ticket, "Ticket created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const {
        name,
        description,
        unitId,
        dueDate,
        taskType,
        subTaskType,
        categoryId,
        priority,
        isRecurring,
        recurringType,
        recurringDay,
        recurringDueDays,
        assetIds,
      } = req.body;

      const imagePath = req.file ? `uploads/${req.file.filename}` : undefined;

      const ticket = await ticketService.update(req.params.id, {
        name,
        description,
        unitId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        taskType,
        subTaskType,
        categoryId,
        priority,
        isRecurring:
          isRecurring !== undefined
            ? isRecurring === "true" || isRecurring === true
            : undefined,
        recurringType: recurringType || undefined,
        recurringDay: recurringDay ? parseInt(recurringDay) : undefined,
        recurringDueDays: recurringDueDays
          ? parseInt(recurringDueDays)
          : undefined,
        imagePath,
        assetIds: assetIds
          ? typeof assetIds === "string"
            ? JSON.parse(assetIds)
            : assetIds
          : undefined,
      }, req.user!.id);

      sendSuccess(res, ticket, "Ticket updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      if (!status) return sendError(res, "Status is required", 400);

      const ticket = await ticketService.updateStatus(req.params.id, status, req.user!.id);
      sendSuccess(res, ticket, "Status updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async addComment(req: Request, res: Response) {
    try {
      const { content } = req.body;
      if (!content) return sendError(res, "Comment content is required", 400);

      const comment = await ticketService.addComment(req.params.id, content, req.user!.id);
      sendSuccess(res, comment, "Comment added", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async assign(req: Request, res: Response) {
    try {
      const { assigneeId } = req.body;
      if (!assigneeId) return sendError(res, "Assignee ID is required", 400);

      const result = await ticketService.assign(
        req.params.id,
        assigneeId,
        req.user!.id
      );
      sendSuccess(res, result, "Ticket assigned");
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  },

  async getAssignableUsers(req: Request, res: Response) {
    try {
      const users = await ticketService.getAssignableUsers(
        req.params.id,
        req.user!.id
      );
      sendSuccess(res, users);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findRelated(req: Request, res: Response) {
    try {
      const ticket = await ticketService.findById(req.params.id);
      if (!ticket) return sendError(res, "Ticket not found", 404);

      const u = req.user!;
      const hasViewAll = u.isSuperAdmin || u.permissions.includes(PERMISSIONS.TICKETS.VIEW_ALL);
      const hasViewAssigned = u.permissions.includes(PERMISSIONS.TICKETS.VIEW_ASSIGNED);
      const isAssignee = ticket.assignedToId === u.id;
      const isCreator = ticket.createdById === u.id;
      const isActiveBlocker = (ticket as any).blocks?.some(
        (b: any) => b.blockingUserId === u.id && !b.resolvedAt
      );

      if (!hasViewAll && !(hasViewAssigned && (isAssignee || isCreator)) && !isActiveBlocker) {
        return sendError(res, "Access denied", 403);
      }

      const related = await ticketService.findRelated(req.params.id);
      sendSuccess(res, related);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async blockTicket(req: Request, res: Response) {
    try {
      const { blockingUserId, departmentId, reason } = req.body;
      if (!departmentId || !reason) {
        return sendError(res, "departmentId and reason are required", 400);
      }

      // Allow: assignee OR anyone with UPDATE_STATUS
      const hasUpdateStatus = req.user!.isSuperAdmin || req.user!.permissions.includes(PERMISSIONS.TICKETS.UPDATE_STATUS);
      if (!hasUpdateStatus) {
        const ticket = await ticketService.findById(req.params.id);
        if (!ticket || ticket.assignedToId !== req.user!.id) {
          return sendError(res, "Only the assignee or managers can report a blocker", 403);
        }
      }

      await ticketService.block(req.params.id, { blockingUserId: blockingUserId || undefined, departmentId, reason }, req.user!.id);
      sendSuccess(res, null, "Ticket blocked");
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  },

  async unblockTicket(req: Request, res: Response) {
    try {
      const { resolvedNote } = req.body;
      const hasUpdateStatus = req.user!.isSuperAdmin || req.user!.permissions.includes(PERMISSIONS.TICKETS.UPDATE_STATUS);

      if (!hasUpdateStatus) {
        // Must be the blocker (blockingUser) or the one who raised it (blockedBy)
        const ticket = await ticketService.findById(req.params.id);
        if (!ticket) return sendError(res, "Ticket not found", 404);
        const activeBlock = (ticket as any).blocks?.find((b: any) => !b.resolvedAt);
        const isInvolved = activeBlock && (activeBlock.blockingUserId === req.user!.id || activeBlock.blockedById === req.user!.id);
        if (!isInvolved) return sendError(res, "Only the blocking parties can unblock this ticket", 403);
      }

      await ticketService.unblock(req.params.id, resolvedNote, req.user!.id);
      sendSuccess(res, null, "Ticket unblocked");
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  },
};
