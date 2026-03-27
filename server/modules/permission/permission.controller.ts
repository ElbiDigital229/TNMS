import type { Request, Response } from "express";
import { permissionService } from "./permission.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const permissionController = {
  async findAll(req: Request, res: Response) {
    try {
      const permissions = await permissionService.findAll();
      sendSuccess(res, permissions);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
