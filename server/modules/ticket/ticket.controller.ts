import type { Request, Response } from "express";
import { ticketService } from "./ticket.service.js";
import { ppmService } from "../ppm/ppm.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import { rbacService } from "../../services/rbac.service.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const ticketController = {
  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, search, status, priority, taskType, propertyId, unitId, assigneeId, createdById, createdFrom, createdTo, dueDateFrom, dueDateTo, blocked, overdue, legacy, deleted, sortBy, sortOrder } =
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
        unitId: unitId as string,
        assigneeId: assigneeId as string,
        createdById: createdById as string,
        createdFrom: createdFrom as string,
        createdTo: createdTo as string,
        dueDateFrom: dueDateFrom as string,
        dueDateTo: dueDateTo as string,
        blocked: blocked as string,
        overdue: overdue as string,
        legacy: legacy as string,
        deleted: deleted as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
        viewMode,
        userId: req.user!.id,
        includeBlockerTicketsForUserId: req.user!.id,
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
        assetIds,
        ppmId,
      } = req.body;

      if (!name || !description || !propertyId) {
        return sendError(res, "Title, description, and property are required", 400);
      }

      const files = req.files as Express.Multer.File[] | undefined;
      const newPaths = files?.map((f) => `uploads/${f.filename}`) || [];
      // Also support legacy single-file field name during transition
      const singleFile = (req as any).file as Express.Multer.File | undefined;
      if (singleFile) newPaths.push(`uploads/${singleFile.filename}`);
      const imagePath = newPaths.length > 0 ? JSON.stringify(newPaths) : undefined;

      const ticket = await ticketService.create({
        name,
        description,
        propertyId,
        unitId: unitId || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        taskType: taskType || "TASK",
        subTaskType: subTaskType || "REACTIVE",
        categoryId: categoryId || undefined,
        departmentId: departmentId || undefined,
        assignedToId: assignedToId || undefined,
        priority: priority || "MEDIUM",
        imagePath,
        assetIds: assetIds
          ? typeof assetIds === "string"
            ? JSON.parse(assetIds)
            : assetIds
          : undefined,
        ppmId: ppmId || undefined,
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
        assetIds,
      } = req.body;

      // Build merged image paths: existing + newly uploaded
      const files = req.files as Express.Multer.File[] | undefined;
      const newPaths = files?.map((f) => `uploads/${f.filename}`) || [];
      const singleFile = (req as any).file as Express.Multer.File | undefined;
      if (singleFile) newPaths.push(`uploads/${singleFile.filename}`);

      let imagePath: string | undefined;
      if (newPaths.length > 0) {
        // Merge with existing images
        const existing = await ticketService.findById(req.params.id);
        const currentImages = existing ? ticketService.parseImagePaths(existing.imagePath) : [];
        const merged = [...currentImages, ...newPaths].slice(0, 5); // cap at 5
        imagePath = JSON.stringify(merged);
      }

      const ticket = await ticketService.update(req.params.id, {
        name,
        description,
        unitId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        taskType,
        subTaskType,
        categoryId,
        priority,
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

  async editComment(req: Request, res: Response) {
    try {
      const { content } = req.body;
      if (!content) return sendError(res, "Comment content is required", 400);

      const comment = await ticketService.editComment(req.params.commentId, content, req.user!.id);
      sendSuccess(res, comment, "Comment updated");
    } catch (error: any) {
      const status = error.message.includes("not found") ? 404 : error.message.includes("only") ? 403 : 400;
      sendError(res, error.message, status);
    }
  },

  async deleteComment(req: Request, res: Response) {
    try {
      await ticketService.deleteComment(req.params.commentId, req.user!.id);
      sendSuccess(res, null, "Comment deleted");
    } catch (error: any) {
      const status = error.message.includes("not found") ? 404 : error.message.includes("only") ? 403 : 400;
      sendError(res, error.message, status);
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

  async updatePpmStep(req: Request, res: Response) {
    try {
      const { status, remarks } = req.body;
      if (!status || !["PENDING", "OK", "NOT_OK", "NA"].includes(status)) {
        return sendError(res, "Invalid status", 400);
      }
      const step = await ppmService.updateStepStatus(req.params.stepId, req.user!.id, {
        status,
        remarks,
      });
      sendSuccess(res, step);
    } catch (e: any) {
      sendError(res, e.message, 400);
    }
  },

  async bulkAssign(req: Request, res: Response) {
    try {
      const { ticketIds, assigneeId } = req.body;
      if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
        return sendError(res, "ticketIds must be a non-empty array", 400);
      }
      if (!assigneeId) return sendError(res, "assigneeId is required", 400);

      const result = await ticketService.bulkAssign(ticketIds, assigneeId, req.user!.id);
      sendSuccess(res, result, `${result.succeeded} ticket(s) reassigned`);
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

  async deleteImage(req: Request, res: Response) {
    try {
      const { imagePath } = req.body;
      if (!imagePath) return sendError(res, "imagePath is required", 400);

      const ticket = await ticketService.findById(req.params.id);
      if (!ticket) return sendError(res, "Ticket not found", 404);

      const currentImages = ticketService.parseImagePaths(ticket.imagePath);
      const filtered = currentImages.filter((p) => p !== imagePath);
      const newValue = filtered.length > 0 ? JSON.stringify(filtered) : null;

      await ticketService.setImagePath(req.params.id, newValue);

      // Try to delete the file from disk
      try {
        const fs = await import("fs/promises");
        await fs.unlink(imagePath);
      } catch { /* ignore if file doesn't exist */ }

      sendSuccess(res, null, "Image deleted");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async bulkImport(req: Request, res: Response) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return sendError(res, "items array is required", 400);
      }
      if (items.length > 5000) {
        return sendError(res, "Maximum 5000 tickets per import", 400);
      }

      const results = await ticketService.bulkCreate(items, req.user!.id);
      const successCount = results.filter((r) => r.status === "success").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      sendSuccess(
        res,
        { results, summary: { total: items.length, success: successCount, errors: errorCount } },
        `Imported ${successCount} tickets, ${errorCount} errors`,
        201
      );
    } catch (error: any) {
      sendError(res, error.message || "Failed to bulk import tickets");
    }
  },

  async softDelete(req: Request, res: Response) {
    try {
      const u = req.user!;
      const hasDelete = u.isSuperAdmin || u.permissions.includes(PERMISSIONS.TICKETS.DELETE);
      if (!hasDelete) return sendError(res, "Access denied", 403);
      const ticket = await ticketService.softDelete(req.params.id, u.id);
      sendSuccess(res, ticket, "Ticket archived");
    } catch (error: any) {
      sendError(res, error.message, 400);
    }
  },

  async restore(req: Request, res: Response) {
    try {
      const u = req.user!;
      const hasDelete = u.isSuperAdmin || u.permissions.includes(PERMISSIONS.TICKETS.DELETE);
      if (!hasDelete) return sendError(res, "Access denied", 403);
      const ticket = await ticketService.restore(req.params.id, u.id);
      sendSuccess(res, ticket, "Ticket restored");
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
