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
        userId: (req as any).user?.id,
        allProperties: (req as any).user?.allProperties,
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
        quantity,
        condition,
        additionalInfo,
        floorId,
        serialNumber,
        purchaseDate,
      } = req.body;

      if (!name || !categoryId || !floorId) {
        return sendError(
          res,
          "Name, category, and floor are required",
          400
        );
      }

      if (purchaseDate && new Date(purchaseDate) > new Date()) {
        return sendError(res, "Purchase date cannot be in the future", 400);
      }

      const imagePath = req.file ? `uploads/${req.file.filename}` : undefined;

      const asset = await assetService.create({
        name,
        categoryId,
        unitOfMeasure: unitOfMeasure || "NOS",
        quantity: quantity ? parseInt(quantity, 10) : undefined,
        condition: condition || "GOOD",
        additionalInfo: additionalInfo || undefined,
        floorId,
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
        quantity,
        condition,
        additionalInfo,
        floorId,
        serialNumber,
        purchaseDate,
      } = req.body;

      if (purchaseDate && new Date(purchaseDate) > new Date()) {
        return sendError(res, "Purchase date cannot be in the future", 400);
      }

      const imagePath = req.file ? `uploads/${req.file.filename}` : undefined;

      const asset = await assetService.update(req.params.id, {
        name,
        categoryId,
        unitOfMeasure,
        quantity: quantity ? parseInt(quantity, 10) : undefined,
        condition,
        additionalInfo,
        floorId,
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

  async bulkDelete(req: Request, res: Response) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return sendError(res, "ids array is required", 400);
      }
      const count = await assetService.bulkDelete(ids);
      sendSuccess(res, { deleted: count }, `${count} asset${count > 1 ? "s" : ""} deleted`);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async bulkImport(req: Request, res: Response) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return sendError(res, "items array is required", 400);
      }
      if (items.length > 500) {
        return sendError(res, "Maximum 500 items per import", 400);
      }

      const results = await assetService.bulkCreate(req.params.propertyId, items);
      const successCount = results.filter((r) => r.status === "success").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      sendSuccess(res, { results, summary: { total: items.length, success: successCount, errors: errorCount } },
        `Imported ${successCount} assets, ${errorCount} errors`, 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
