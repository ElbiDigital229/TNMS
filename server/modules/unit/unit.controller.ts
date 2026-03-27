import type { Request, Response } from "express";
import { unitService } from "./unit.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const unitController = {
  async findByProperty(req: Request, res: Response) {
    try {
      const units = await unitService.findByProperty(req.params.propertyId);
      sendSuccess(res, units);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, unitType, floorId, description } = req.body;
      if (!name || !unitType || !floorId) {
        return sendError(res, "Name, unit type, and floor are required", 400);
      }

      const unit = await unitService.create({
        name,
        unitType,
        floorId,
        propertyId: req.params.propertyId,
        description: description || undefined,
      });

      sendSuccess(res, unit, "Unit created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name, unitType, floorId, description } = req.body;
      const unit = await unitService.update(req.params.id, {
        name,
        unitType,
        floorId,
        description,
      });
      sendSuccess(res, unit, "Unit updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const unit = await unitService.deactivate(req.params.id);
      sendSuccess(res, unit, "Unit deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const unit = await unitService.activate(req.params.id);
      sendSuccess(res, unit, "Unit activated");
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

      const results = await unitService.bulkCreate(req.params.propertyId, items);
      const successCount = results.filter((r) => r.status === "success").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      sendSuccess(res, { results, summary: { total: items.length, success: successCount, errors: errorCount } },
        `Imported ${successCount} units, ${errorCount} errors`, 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
