import type { Request, Response } from "express";
import { ticketCategoryService } from "./ticket-category.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const ticketCategoryController = {
  async findAll(_req: Request, res: Response) {
    try {
      const categories = await ticketCategoryService.findAll();
      sendSuccess(res, categories);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Name is required", 400);
      const category = await ticketCategoryService.create(name);
      sendSuccess(res, category, "Category created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Name is required", 400);
      const category = await ticketCategoryService.update(req.params.id, name);
      sendSuccess(res, category, "Category updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const category = await ticketCategoryService.deactivate(req.params.id);
      sendSuccess(res, category, "Category deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const category = await ticketCategoryService.activate(req.params.id);
      sendSuccess(res, category, "Category activated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
