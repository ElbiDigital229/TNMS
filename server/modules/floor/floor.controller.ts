import type { Request, Response } from "express";
import { floorService, bulkCreateFloors, bulkDeleteFloors } from "./floor.service.js";
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

  async bulkImport(req: Request, res: Response) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return sendError(res, "items array is required", 400);
      }
      if (items.length > 5000) {
        return sendError(res, "Maximum 5000 items per import", 400);
      }

      const results = await bulkCreateFloors(req.params.propertyId, items);
      const successCount = results.filter((r) => r.status === "success").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      sendSuccess(res, { results, summary: { total: items.length, success: successCount, errors: errorCount } },
        `Imported ${successCount} floors, ${errorCount} errors`, 201);
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

      const count = await bulkDeleteFloors(ids);
      sendSuccess(res, { deleted: count }, `${count} floor${count > 1 ? "s" : ""} deleted`);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
