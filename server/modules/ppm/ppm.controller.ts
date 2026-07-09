import type { Request, Response } from "express";
import { ppmService } from "./ppm.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const ppmController = {
  async findAll(req: Request, res: Response) {
    try {
      const { status, search } = req.query;
      const data = await ppmService.findAll({
        status: status as string,
        search: search as string,
      });
      sendSuccess(res, data);
    } catch (e: any) {
      sendError(res, e.message);
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const data = await ppmService.findById(req.params.id);
      sendSuccess(res, data);
    } catch (e: any) {
      sendError(res, e.message, 404);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = await ppmService.create(req.body);
      sendSuccess(res, data, "PPM created", 201);
    } catch (e: any) {
      sendError(res, e.message, 400);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const data = await ppmService.update(req.params.id, req.body);
      sendSuccess(res, data, "PPM updated");
    } catch (e: any) {
      sendError(res, e.message, 400);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      await ppmService.deactivate(req.params.id);
      sendSuccess(res, null, "PPM deactivated");
    } catch (e: any) {
      sendError(res, e.message, 400);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      await ppmService.activate(req.params.id);
      sendSuccess(res, null, "PPM activated");
    } catch (e: any) {
      sendError(res, e.message, 400);
    }
  },
};
