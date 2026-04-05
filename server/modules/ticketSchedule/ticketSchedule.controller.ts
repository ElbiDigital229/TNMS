import type { Request, Response } from "express";
import { ticketScheduleService } from "./ticketSchedule.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const ticketScheduleController = {
  async findAll(req: Request, res: Response) {
    try {
      const result = await ticketScheduleService.findAll({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        propertyId: req.query.propertyId as string,
        isActive: req.query.isActive === "true" ? true : req.query.isActive === "false" ? false : undefined,
        userId: req.user!.id,
        isSuperAdmin: req.user!.isSuperAdmin,
        allProperties: req.user!.allProperties,
      });
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const result = await ticketScheduleService.findById(req.params.id);
      if (!result) return sendError(res, "Schedule not found", 404);
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const result = await ticketScheduleService.create({
        ...req.body,
        createdById: req.user!.id,
      });
      sendSuccess(res, result, "Created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const result = await ticketScheduleService.update(req.params.id, req.body);
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await ticketScheduleService.delete(req.params.id);
      sendSuccess(res, { message: "Schedule deleted" });
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async toggle(req: Request, res: Response) {
    try {
      const result = await ticketScheduleService.toggle(req.params.id);
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
