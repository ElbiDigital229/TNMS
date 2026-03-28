import type { Request, Response } from "express";
import { notificationService } from "./notification.service.js";
import { notificationTrigger } from "../../services/notificationTrigger.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const notificationController = {
  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, isRead, type } = req.query;

      const result = await notificationService.findByUser(req.user!.id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        isRead: isRead !== undefined ? isRead === "true" : undefined,
        type: type as any,
      });

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async getUnreadCount(req: Request, res: Response) {
    try {
      const count = await notificationService.getUnreadCount(req.user!.id);
      sendSuccess(res, { count });
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async markAsRead(req: Request, res: Response) {
    try {
      await notificationService.markAsRead(req.params.id, req.user!.id);
      sendSuccess(res, null, "Notification marked as read");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async markAllAsRead(req: Request, res: Response) {
    try {
      await notificationService.markAllAsRead(req.user!.id);
      sendSuccess(res, null, "All notifications marked as read");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  /** Triggered by internal cron — checks overdue and due-soon tickets */
  async runScheduledChecks(_req: Request, res: Response) {
    try {
      // Only allow if caller is super admin
      if (!_req.user?.isSuperAdmin) {
        return sendError(res, "Forbidden", 403);
      }

      const [overdueCount, dueSoonCount] = await Promise.all([
        notificationTrigger.checkOverdueTickets(),
        notificationTrigger.checkDueSoonTickets(),
      ]);

      sendSuccess(res, { overdueCount, dueSoonCount }, "Scheduled checks complete");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
