import type { Request, Response } from "express";
import { landService } from "./land.service.js";
import { sendSuccess, sendError } from "../../../utils/apiResponse.js";
import { rowsToCsv } from "../_shared.js";

export const landController = {
  async findAll(req: Request, res: Response) {
    try {
      const result = await landService.findAll(req.query as any);
      sendSuccess(res, result);
    } catch (e: any) {
      sendError(res, e.message || "Failed to fetch land records");
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const land = await landService.findById(req.params.id);
      if (!land) return sendError(res, "Land record not found", 404);
      sendSuccess(res, land);
    } catch (e: any) {
      sendError(res, e.message || "Failed to fetch land record");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const land = await landService.create(req.body);
      sendSuccess(res, land, "Land record created", 201);
    } catch (e: any) {
      sendError(res, e.message || "Failed to create land record");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const land = await landService.update(req.params.id, req.body);
      sendSuccess(res, land, "Land record updated");
    } catch (e: any) {
      sendError(res, e.message || "Failed to update land record");
    }
  },

  async softDelete(req: Request, res: Response) {
    try {
      const land = await landService.softDelete(req.params.id);
      sendSuccess(res, land, "Land record archived");
    } catch (e: any) {
      sendError(res, e.message || "Failed to archive land record");
    }
  },

  async restore(req: Request, res: Response) {
    try {
      const land = await landService.restore(req.params.id);
      sendSuccess(res, land, "Land record restored");
    } catch (e: any) {
      sendError(res, e.message || "Failed to restore land record");
    }
  },

  async bulkImport(req: Request, res: Response) {
    try {
      const { items } = req.body;
      const results = await landService.bulkCreate(items);
      const success = results.filter((r) => r.status === "success").length;
      const errors = results.filter((r) => r.status === "error").length;
      sendSuccess(
        res,
        { results, summary: { total: items.length, success, errors } },
        `Imported ${success} land records, ${errors} errors`,
        201,
      );
    } catch (e: any) {
      sendError(res, e.message || "Bulk import failed");
    }
  },

  async exportCsv(req: Request, res: Response) {
    try {
      const result = await landService.findAll({ ...(req.query as any), limit: 5000 });
      const csv = rowsToCsv(result.data, [
        { key: "landCode", label: "Land ID" },
        { key: "agent.agentCode", label: "Agent Code" },
        { key: "agent.agentName", label: "Agent Name" },
        { key: "city", label: "City" },
        { key: "areaLocation", label: "Area / Location" },
        { key: "addressDescription", label: "Address / Description" },
        { key: "coordinates", label: "Coordinates" },
        { key: "plotSizeKanal", label: "Plot Size (Kanal)" },
        { key: "frontRoadWidthFt", label: "Front Road Width (ft)" },
        { key: "zoning", label: "Zoning" },
        { key: "developmentStatus", label: "Development Status" },
        { key: "maxCoveredAreaSqft", label: "Maximum Covered Area (sqft)" },
        { key: "utilities", label: "Utilities Available" },
        { key: "parkingPotential", label: "Parking Potential" },
        { key: "proposedModel", label: "Proposed Model" },
        { key: "askingPrice", label: "Asking Price" },
        { key: "ownerFlexibility", label: "Owner Flexibility" },
        { key: "stage", label: "Stage" },
        { key: "status", label: "Status" },
        { key: "lastAvailabilityCheck", label: "Last Availability Check" },
        { key: "notes", label: "Notes" },
      ]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="acquisition-land-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (e: any) {
      sendError(res, e.message || "Failed to export land records");
    }
  },
};
