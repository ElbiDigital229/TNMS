import type { Request, Response } from "express";
import { areaGroupService } from "./area-group.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const areaGroupController = {
  async findAll(_req: Request, res: Response) {
    try {
      const groups = await areaGroupService.findAll();
      sendSuccess(res, groups);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const { city, groupName } = req.body;
      if (!city || !groupName) {
        return sendError(res, "City and group name are required", 400);
      }

      const group = await areaGroupService.upsert(city, groupName);
      sendSuccess(res, group, "Area group updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
