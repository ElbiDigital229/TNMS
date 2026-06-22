import { z } from "zod";

// The report builder accepts fairly free-form queries; we validate the
// known envelope shape and leave filters as a loose object. Unknown entity
// or measure names are rejected so the SQL builder never sees garbage.

// Plural to match the frontend payload and the report.service.ts Entity
// type. The previous singular form rejected every legitimate query at
// the validation layer ("Validation failed" toast in the UI).
const entityEnum = z.enum(["tickets", "assets", "properties", "units", "users"]);
const granularityEnum = z.enum(["day", "week", "month", "quarter", "year"]);

export const runQuerySchema = z.object({
  entity: entityEnum,
  measure: z.string().trim().min(1).max(100),
  groupBy: z.string().trim().max(100).optional(),
  filters: z.array(z.record(z.any())).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
  granularity: granularityEnum.optional(),
  trendStart: z.string().optional(),
  trendEnd: z.string().optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user id"),
});
export const departmentIdParamSchema = z.object({
  departmentId: z.string().uuid("Invalid department id"),
});
export const propertyIdParamSchema = z.object({
  propertyId: z.string().uuid("Invalid property id"),
});
export const assetIdParamSchema = z.object({
  assetId: z.string().uuid("Invalid asset id"),
});
