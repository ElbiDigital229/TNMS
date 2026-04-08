import type { Request, Response } from "express";
import { designationService } from "./designation.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const designationController = {
  async findAll(_req: Request, res: Response) {
    try {
      const items = await designationService.findAll();
      sendSuccess(res, items);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Name is required", 400);
      const item = await designationService.create(name);
      sendSuccess(res, item, "Designation created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Name is required", 400);
      const item = await designationService.update(req.params.id, name);
      sendSuccess(res, item, "Designation updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const item = await designationService.deactivate(req.params.id);
      sendSuccess(res, item, "Designation deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const item = await designationService.activate(req.params.id);
      sendSuccess(res, item, "Designation activated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
