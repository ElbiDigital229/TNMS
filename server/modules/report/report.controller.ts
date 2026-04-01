import type { Request, Response } from "express";
import { reportService, entityReportService } from "./report.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const reportController = {
  async runQuery(req: Request, res: Response) {
    try {
      const { entity, measure, groupBy, filters, sortOrder, limit, granularity, trendStart, trendEnd } = req.body;

      if (!entity || !measure) {
        return sendError(res, "entity and measure are required", 400);
      }

      const result = await reportService.runQuery(
        { entity, measure, groupBy: groupBy || "status", filters: filters || [], sortOrder: sortOrder || "desc", limit: limit || 50, granularity, trendStart, trendEnd },
        req.user!.id,
        req.user!.isSuperAdmin,
        req.user!.allProperties
      );

      sendSuccess(res, result);
    } catch (error: any) {
      if (error.status) {
        return sendError(res, error.message, error.status);
      }
      sendError(res, error.message || "Failed to run report");
    }
  },

  async getUserReport(req: Request, res: Response) {
    try {
      const result = await entityReportService.getUser(
        req.params.userId,
        req.user!.id,
        req.user!.isSuperAdmin,
        req.user!.allProperties,
      );
      sendSuccess(res, result);
    } catch (error: any) {
      if (error.status) return sendError(res, error.message, error.status);
      sendError(res, error.message || "Failed to generate report");
    }
  },

  async getDepartmentReport(req: Request, res: Response) {
    try {
      const result = await entityReportService.getDepartment(
        req.params.departmentId,
        req.user!.id,
        req.user!.isSuperAdmin,
        req.user!.allProperties,
      );
      sendSuccess(res, result);
    } catch (error: any) {
      if (error.status) return sendError(res, error.message, error.status);
      sendError(res, error.message || "Failed to generate report");
    }
  },

  async getPropertyReport(req: Request, res: Response) {
    try {
      const result = await entityReportService.getProperty(
        req.params.propertyId,
        req.user!.id,
        req.user!.isSuperAdmin,
        req.user!.allProperties,
      );
      sendSuccess(res, result);
    } catch (error: any) {
      if (error.status) return sendError(res, error.message, error.status);
      sendError(res, error.message || "Failed to generate report");
    }
  },

  async getAssetReport(req: Request, res: Response) {
    try {
      const result = await entityReportService.getAsset(
        req.params.assetId,
        req.user!.id,
        req.user!.isSuperAdmin,
        req.user!.allProperties,
      );
      sendSuccess(res, result);
    } catch (error: any) {
      if (error.status) return sendError(res, error.message, error.status);
      sendError(res, error.message || "Failed to generate report");
    }
  },
};
