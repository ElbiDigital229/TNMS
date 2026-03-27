import type { Request, Response } from "express";
import { assetCategoryService } from "./asset-category.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const assetCategoryController = {
  async findAll(_req: Request, res: Response) {
    try {
      const categories = await assetCategoryService.findAll();
      sendSuccess(res, categories);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Category name is required", 400);

      const category = await assetCategoryService.create(name);
      sendSuccess(res, category, "Category created", 201);
    } catch (error: any) {
      if (error.code === "P2002") {
        return sendError(res, "Category name already exists", 409);
      }
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name } = req.body;
      if (!name) return sendError(res, "Category name is required", 400);

      const category = await assetCategoryService.update(req.params.id, name);
      sendSuccess(res, category, "Category updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const category = await assetCategoryService.deactivate(req.params.id);
      sendSuccess(res, category, "Category deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const category = await assetCategoryService.activate(req.params.id);
      sendSuccess(res, category, "Category activated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
