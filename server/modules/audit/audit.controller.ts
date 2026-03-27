import type { Request, Response } from "express";
import { auditService } from "../../services/audit.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const auditController = {
  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, module, action, userId, dateFrom, dateTo } = req.query;

      const result = await auditService.findAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        module: module as string,
        action: action as string,
        userId: userId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message || "Failed to fetch audit logs");
    }
  },

  async exportLogs(req: Request, res: Response) {
    try {
      const { module, action, userId, dateFrom, dateTo } = req.query;

      const result = await auditService.findAll({
        page: 1,
        limit: 10000,
        module: module as string,
        action: action as string,
        userId: userId as string,
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      });

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=audit-logs.json");
      res.send(JSON.stringify(result.data, null, 2));
    } catch (error: any) {
      sendError(res, error.message || "Failed to export audit logs");
    }
  },
};
