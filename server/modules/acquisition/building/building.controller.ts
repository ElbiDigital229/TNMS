import type { Request, Response } from "express";
import { buildingService } from "./building.service.js";
import { sendSuccess, sendError } from "../../../utils/apiResponse.js";
import { rowsToCsv } from "../_shared.js";

export const buildingController = {
  async findAll(req: Request, res: Response) {
    try {
      const result = await buildingService.findAll(req.query as any);
      sendSuccess(res, result);
    } catch (e: any) {
      sendError(res, e.message || "Failed to fetch building records");
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const building = await buildingService.findById(req.params.id);
      if (!building) return sendError(res, "Building record not found", 404);
      sendSuccess(res, building);
    } catch (e: any) {
      sendError(res, e.message || "Failed to fetch building record");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const building = await buildingService.create(req.body);
      sendSuccess(res, building, "Building record created", 201);
    } catch (e: any) {
      sendError(res, e.message || "Failed to create building record");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const building = await buildingService.update(req.params.id, req.body);
      sendSuccess(res, building, "Building record updated");
    } catch (e: any) {
      sendError(res, e.message || "Failed to update building record");
    }
  },

  async softDelete(req: Request, res: Response) {
    try {
      const building = await buildingService.softDelete(req.params.id);
      sendSuccess(res, building, "Building record archived");
    } catch (e: any) {
      sendError(res, e.message || "Failed to archive building record");
    }
  },

  async restore(req: Request, res: Response) {
    try {
      const building = await buildingService.restore(req.params.id);
      sendSuccess(res, building, "Building record restored");
    } catch (e: any) {
      sendError(res, e.message || "Failed to restore building record");
    }
  },

  async bulkImport(req: Request, res: Response) {
    try {
      const { items } = req.body;
      const results = await buildingService.bulkCreate(items);
      const success = results.filter((r) => r.status === "success").length;
      const errors = results.filter((r) => r.status === "error").length;
      sendSuccess(
        res,
        { results, summary: { total: items.length, success, errors } },
        `Imported ${success} building records, ${errors} errors`,
        201,
      );
    } catch (e: any) {
      sendError(res, e.message || "Bulk import failed");
    }
  },

  async exportCsv(req: Request, res: Response) {
    try {
      const result = await buildingService.findAll({ ...(req.query as any), limit: 5000 });
      const csv = rowsToCsv(result.data, [
        { key: "buildingCode", label: "Property ID" },
        { key: "agent.agentCode", label: "Agent Code" },
        { key: "agent.agentName", label: "Agent Name" },
        { key: "city", label: "City" },
        { key: "areaLocation", label: "Area / Location" },
        { key: "propertyAddress", label: "Property Address" },
        { key: "coordinates", label: "Coordinates" },
        { key: "coveredAreaSqft", label: "Covered Area (sqft)" },
        { key: "plotSizeKanal", label: "Plot Size (Kanal)" },
        { key: "floors", label: "Floors" },
        { key: "floorPlateSizeSqft", label: "Floor Plate Size (sqft)" },
        { key: "parkingCapacity", label: "Parking Capacity" },
        { key: "buildingStatus", label: "Building Status" },
        { key: "possessionTimeline", label: "Possession Timeline" },
        { key: "utilities", label: "Utilities Available" },
        { key: "powerBackup", label: "Power Backup" },
        { key: "elevators", label: "Elevators" },
        { key: "proposedModel", label: "Proposed Model" },
        { key: "askingRent", label: "Asking Rent" },
        { key: "stage", label: "Stage" },
        { key: "status", label: "Status" },
        { key: "lastAvailabilityCheck", label: "Last Availability Check" },
        { key: "notes", label: "Notes" },
      ]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="acquisition-buildings-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (e: any) {
      sendError(res, e.message || "Failed to export building records");
    }
  },
};
