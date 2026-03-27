import type { Request, Response } from "express";
import { ticketService } from "./ticket.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";
import { rbacService } from "../../services/rbac.service.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const ticketController = {
  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, search, status, priority, taskType, propertyId } =
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
        viewMode,
        userId: req.user!.id,
      });
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const ticket = await ticketService.findById(req.params.id);
      if (!ticket) return sendError(res, "Ticket not found", 404);
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
        priority,
        isRecurring,
        recurringType,
        recurringDay,
        recurringDueDays,
        assetIds,
      } = req.body;

      if (
        !name ||
        !description ||
        !propertyId ||
        !unitId ||
        !dueDate ||
        !taskType ||
        !subTaskType ||
        !categoryId ||
        !priority
      ) {
        return sendError(res, "Missing required fields", 400);
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
      });

      sendSuccess(res, ticket, "Ticket updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async updateStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      if (!status) return sendError(res, "Status is required", 400);

      const ticket = await ticketService.updateStatus(req.params.id, status);
      sendSuccess(res, ticket, "Status updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async addComment(req: Request, res: Response) {
    try {
      const { content } = req.body;
      if (!content) return sendError(res, "Comment content is required", 400);

      const comment = await ticketService.addComment(req.params.id, content);
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
};
