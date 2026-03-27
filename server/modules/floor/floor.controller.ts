import type { Request, Response } from "express";
import { floorService } from "./floor.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const floorController = {
  async findByProperty(req: Request, res: Response) {
    try {
      const floors = await floorService.findByProperty(req.params.propertyId);
      sendSuccess(res, floors);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Floor name is required", 400);

      const floor = await floorService.create(req.params.propertyId, name);
      sendSuccess(res, floor, "Floor created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Floor name is required", 400);

      const floor = await floorService.update(req.params.id, name);
      sendSuccess(res, floor, "Floor updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const floor = await floorService.deactivate(req.params.id);
      sendSuccess(res, floor, "Floor deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const floor = await floorService.activate(req.params.id);
      sendSuccess(res, floor, "Floor activated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
