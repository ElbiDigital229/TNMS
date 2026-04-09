import { z } from "zod";

const optionalUuidOrEmpty = z
  .string()
  .uuid("Invalid id")
  .optional()
  .or(z.literal(""));

export const createUnitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  unitType: z.string().trim().max(100).optional().or(z.literal("")),
  floorId: optionalUuidOrEmpty,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateUnitSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  unitType: z.string().trim().max(100).optional().or(z.literal("")),
  floorId: optionalUuidOrEmpty,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const propertyUnitParamSchema = z.object({
  propertyId: z.string().uuid("Invalid property id"),
});

export const bulkDeleteUnitsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
});

export const bulkImportUnitsSchema = z.object({
  items: z.array(z.record(z.any())).min(1).max(5000),
});

export const listUnitsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().max(200).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "all"]).optional(),
});
