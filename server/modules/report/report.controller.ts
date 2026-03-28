import type { Request, Response } from "express";
import { reportService } from "./report.service.js";
import type { ReportQuery } from "./report.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

const VALID_ENTITIES = ["tickets", "assets", "properties", "units"];
const VALID_MEASURES = ["count", "avg_completion_time"];
const VALID_OPERATORS = ["eq", "in", "between", "gte", "lte"];
const VALID_SORT_ORDERS = ["asc", "desc"];

export const reportController = {
  async query(req: Request, res: Response) {
    try {
      const { entity, measure, groupBy, filters, sortOrder, limit } = req.body;

      // Validate required fields
      if (!entity || !groupBy) {
        return sendError(res, "entity and groupBy are required", 400);
      }

      // Validate entity
      if (!VALID_ENTITIES.includes(entity)) {
        return sendError(
          res,
          `Invalid entity "${entity}". Allowed: ${VALID_ENTITIES.join(", ")}`,
          400
        );
      }

      // Validate measure
      const resolvedMeasure = measure || "count";
      if (!VALID_MEASURES.includes(resolvedMeasure)) {
        return sendError(
          res,
          `Invalid measure "${measure}". Allowed: ${VALID_MEASURES.join(", ")}`,
          400
        );
      }

      // Validate sortOrder
      const resolvedSortOrder = sortOrder || "desc";
      if (!VALID_SORT_ORDERS.includes(resolvedSortOrder)) {
        return sendError(
          res,
          `Invalid sortOrder "${sortOrder}". Allowed: ${VALID_SORT_ORDERS.join(", ")}`,
          400
        );
      }

      // Validate filters
      const resolvedFilters = filters || [];
      if (!Array.isArray(resolvedFilters)) {
        return sendError(res, "filters must be an array", 400);
      }
      for (const filter of resolvedFilters) {
        if (!filter.field || !filter.operator || filter.value === undefined) {
          return sendError(res, "Each filter must have field, operator, and value", 400);
        }
        if (!VALID_OPERATORS.includes(filter.operator)) {
          return sendError(
            res,
            `Invalid filter operator "${filter.operator}". Allowed: ${VALID_OPERATORS.join(", ")}`,
            400
          );
        }
        if (filter.operator === "between" && (!Array.isArray(filter.value) || filter.value.length !== 2)) {
          return sendError(res, `"between" operator requires a value array of exactly 2 elements`, 400);
        }
        if (filter.operator === "in" && !Array.isArray(filter.value)) {
          return sendError(res, `"in" operator requires a value array`, 400);
        }
      }

      // Validate limit
      const resolvedLimit = typeof limit === "number" ? limit : 50;
      if (typeof limit !== "undefined" && (typeof limit !== "number" || limit < 1)) {
        return sendError(res, "limit must be a positive number", 400);
      }

      const reportQuery: ReportQuery = {
        entity,
        measure: resolvedMeasure,
        groupBy,
        filters: resolvedFilters,
        sortOrder: resolvedSortOrder,
        limit: resolvedLimit,
      };

      const result = await reportService.runQuery(
        reportQuery,
        req.user!.id,
        req.user!.isSuperAdmin,
        req.user!.allProperties
      );

      sendSuccess(res, result);
    } catch (error: any) {
      if (error.status) {
        return sendError(res, error.message, error.status);
      }
      sendError(res, error.message);
    }
  },
};
