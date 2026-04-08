import type { Request, Response } from "express";
import { dashboardService } from "./dashboard.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const dashboardController = {
  async getStats(req: Request, res: Response) {
    try {
      const stats = await dashboardService.getStats(
        req.user!.id,
        req.user!.isSuperAdmin,
        req.user!.allProperties,
      );
      sendSuccess(res, stats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
