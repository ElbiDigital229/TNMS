import type { Request, Response } from "express";
import { assetService } from "./asset.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const assetController = {
  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, search, status } = req.query;
      const result = await assetService.findAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        status: status as string,
      });
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findByProperty(req: Request, res: Response) {
    try {
      const assets = await assetService.findByProperty(req.params.propertyId);
      sendSuccess(res, assets);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const asset = await assetService.findById(req.params.id);
      if (!asset) return sendError(res, "Asset not found", 404);
      sendSuccess(res, asset);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findByCode(req: Request, res: Response) {
    try {
      const asset = await assetService.findByCode(req.params.code);
      if (!asset) return sendError(res, "Asset not found", 404);
      sendSuccess(res, asset);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const {
        name,
        categoryId,
        unitOfMeasure,
        condition,
        additionalInfo,
        unitId,
        serialNumber,
        purchaseDate,
      } = req.body;

      if (!name || !categoryId || !unitOfMeasure || !condition || !unitId) {
        return sendError(
          res,
          "Name, category, unit of measure, condition, and unit are required",
          400
        );
      }

      const imagePath = req.file ? `uploads/${req.file.filename}` : undefined;

      const asset = await assetService.create({
        name,
        categoryId,
        unitOfMeasure,
        condition,
        additionalInfo: additionalInfo || undefined,
        unitId,
        propertyId: req.params.propertyId,
        serialNumber: serialNumber || undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        imagePath,
      });

      sendSuccess(res, asset, "Asset created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const {
        name,
        categoryId,
        unitOfMeasure,
        condition,
        additionalInfo,
        unitId,
        serialNumber,
        purchaseDate,
      } = req.body;

      const imagePath = req.file ? `uploads/${req.file.filename}` : undefined;

      const asset = await assetService.update(req.params.id, {
        name,
        categoryId,
        unitOfMeasure,
        condition,
        additionalInfo,
        unitId,
        serialNumber,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        imagePath,
      });

      sendSuccess(res, asset, "Asset updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const asset = await assetService.deactivate(req.params.id);
      sendSuccess(res, asset, "Asset deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const asset = await assetService.activate(req.params.id);
      sendSuccess(res, asset, "Asset activated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
