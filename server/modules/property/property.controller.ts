import type { Request, Response } from "express";
import { propertyService } from "./property.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const propertyController = {
  async create(req: Request, res: Response) {
    try {
      const { name, type, city, description, latitude, longitude } = req.body;

      if (!name || !type || !city) {
        return sendError(res, "Name, type, and city are required", 400);
      }

      const imagePath = req.file ? `uploads/${req.file.filename}` : undefined;

      const property = await propertyService.create({
        name,
        type,
        city,
        description: description || undefined,
        imagePath,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
      });

      sendSuccess(res, property, "Property created", 201);
    } catch (error: any) {
      sendError(res, error.message || "Failed to create property");
    }
  },

  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, search, city, type, status, areaGroupId } =
        req.query;

      // Get user's accessible property IDs
      const { rbacService } = await import("../../services/rbac.service.js");
      const userPropertyIds = await rbacService.getUserPropertyIds(req.user!.id);

      const result = await propertyService.findAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        city: city as any,
        type: type as any,
        status: status as any,
        areaGroupId: areaGroupId as string,
        propertyIds: userPropertyIds === "all" ? undefined : userPropertyIds,
      });

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message || "Failed to fetch properties");
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const property = await propertyService.findById(req.params.id);

      if (!property) {
        return sendError(res, "Property not found", 404);
      }

      sendSuccess(res, property);
    } catch (error: any) {
      sendError(res, error.message || "Failed to fetch property");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name, type, city, description, latitude, longitude } = req.body;

      const imagePath = req.file ? `uploads/${req.file.filename}` : req.body.removeImage === "true" ? null : undefined;

      const property = await propertyService.update(req.params.id, {
        name,
        type,
        city,
        description,
        imagePath,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
      });

      sendSuccess(res, property, "Property updated");
    } catch (error: any) {
      sendError(res, error.message || "Failed to update property");
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const property = await propertyService.deactivate(req.params.id);
      sendSuccess(res, property, "Property deactivated");
    } catch (error: any) {
      sendError(res, error.message || "Failed to deactivate property");
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const property = await propertyService.activate(req.params.id);
      sendSuccess(res, property, "Property activated");
    } catch (error: any) {
      sendError(res, error.message || "Failed to activate property");
    }
  },

  async exportCsv(req: Request, res: Response) {
    try {
      const { search, city, type, status, areaGroupId } = req.query;
      const { rbacService } = await import("../../services/rbac.service.js");
      const userPropertyIds = await rbacService.getUserPropertyIds(req.user!.id);

      const properties = await propertyService.findAllForExport({
        search: search as string,
        city: city as any,
        type: type as any,
        status: status as any,
        areaGroupId: areaGroupId as string,
        propertyIds: userPropertyIds === "all" ? undefined : userPropertyIds,
      });

      const escape = (v: any) => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      const headers = ["Code", "Name", "Type", "City", "Area Group", "Status", "Floors", "Units", "Assets", "Description"];
      const rows = properties.map((p) => [
        p.code,
        p.name,
        p.type,
        p.city,
        p.areaGroup?.groupName ?? "",
        p.status,
        p._count.floors,
        p._count.units,
        p._count.assets,
        p.description ?? "",
      ].map(escape).join(","));

      const csv = [headers.join(","), ...rows].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="properties_${Date.now()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      sendError(res, error.message || "Failed to export properties");
    }
  },
};
