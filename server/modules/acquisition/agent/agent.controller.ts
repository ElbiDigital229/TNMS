import type { Request, Response } from "express";
import { agentService } from "./agent.service.js";
import { sendSuccess, sendError } from "../../../utils/apiResponse.js";
import { rowsToCsv } from "../_shared.js";

export const agentController = {
  async findAll(req: Request, res: Response) {
    try {
      const result = await agentService.findAll(req.query as any);
      sendSuccess(res, result);
    } catch (e: any) {
      sendError(res, e.message || "Failed to fetch agents");
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const agent = await agentService.findById(req.params.id);
      if (!agent) return sendError(res, "Agent not found", 404);
      sendSuccess(res, agent);
    } catch (e: any) {
      sendError(res, e.message || "Failed to fetch agent");
    }
  },

  async findDeals(req: Request, res: Response) {
    try {
      const deals = await agentService.findDeals(req.params.id);
      sendSuccess(res, deals);
    } catch (e: any) {
      sendError(res, e.message || "Failed to fetch agent deals");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const agent = await agentService.create(req.body);
      sendSuccess(res, agent, "Agent created", 201);
    } catch (e: any) {
      sendError(res, e.message || "Failed to create agent");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const agent = await agentService.update(req.params.id, req.body);
      sendSuccess(res, agent, "Agent updated");
    } catch (e: any) {
      sendError(res, e.message || "Failed to update agent");
    }
  },

  async softDelete(req: Request, res: Response) {
    try {
      const agent = await agentService.softDelete(req.params.id);
      sendSuccess(res, agent, "Agent archived");
    } catch (e: any) {
      sendError(res, e.message || "Failed to archive agent");
    }
  },

  async restore(req: Request, res: Response) {
    try {
      const agent = await agentService.restore(req.params.id);
      sendSuccess(res, agent, "Agent restored");
    } catch (e: any) {
      sendError(res, e.message || "Failed to restore agent");
    }
  },

  async bulkImport(req: Request, res: Response) {
    try {
      const { items } = req.body;
      const results = await agentService.bulkCreate(items);
      const success = results.filter((r) => r.status === "success").length;
      const errors = results.filter((r) => r.status === "error").length;
      sendSuccess(
        res,
        { results, summary: { total: items.length, success, errors } },
        `Imported ${success} agents, ${errors} errors`,
        201,
      );
    } catch (e: any) {
      sendError(res, e.message || "Bulk import failed");
    }
  },

  async exportCsv(req: Request, res: Response) {
    try {
      // Same filters as findAll but no pagination — pull all matching rows.
      const result = await agentService.findAll({ ...(req.query as any), limit: 5000 });
      const csv = rowsToCsv(result.data, [
        { key: "agentCode", label: "Agent Code" },
        { key: "agentName", label: "Agent Name" },
        { key: "companyName", label: "Company Name" },
        { key: "contactNumber", label: "Contact Number" },
        { key: "email", label: "Email" },
        { key: "city", label: "City" },
        { key: "areaFocus", label: "Area Focus" },
        { key: "sourceType", label: "Source Type" },
        { key: "rating", label: "Rating" },
        { key: "firstContactDate", label: "First Contact Date" },
        { key: "status", label: "Status" },
        { key: "lastAvailabilityCheck", label: "Last Availability Check" },
        { key: "activeDeals", label: "Active Deals" },
        { key: "notes", label: "Notes" },
      ]);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="acquisition-agents-${new Date().toISOString().slice(0, 10)}.csv"`,
      );
      res.send(csv);
    } catch (e: any) {
      sendError(res, e.message || "Failed to export agents");
    }
  },
};
