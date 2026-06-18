import { z } from "zod";

// Asset create/update are multipart/form-data (image upload). Text fields
// arrive as strings. Coerce numerics, validate enums, reject garbage.

const conditionEnum = z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]);
const statusEnum = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]);

const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  });

const optionalIsoDate = z
  .string()
  .optional()
  .refine(
    (v) => v === undefined || v === "" || !Number.isNaN(Date.parse(v)),
    { message: "Invalid date" },
  )
  .transform((v) => (v === undefined || v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || new Date(v) <= new Date(),
    { message: "Purchase date cannot be in the future" },
  );

/** Accepts a UUID, empty string, or null — empty / null = "no unit". */
const optionalUnitId = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v === "" || v === null ? undefined : v))
  .refine(
    (v) => v === undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
    { message: "Invalid unitId" },
  );

export const createAssetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  categoryId: z.string().uuid("Invalid categoryId"),
  unitOfMeasure: z.string().trim().max(20).optional().or(z.literal("")),
  quantity: optionalInt,
  condition: conditionEnum.optional(),
  additionalInfo: z.string().trim().max(2000).optional().or(z.literal("")),
  floorId: z.string().uuid("Invalid floorId"),
  unitId: optionalUnitId,
  serialNumber: z.string().trim().max(200).optional().or(z.literal("")),
  purchaseDate: optionalIsoDate,
});

export const updateAssetSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  unitOfMeasure: z.string().trim().max(20).optional().or(z.literal("")),
  quantity: optionalInt,
  condition: conditionEnum.optional(),
  additionalInfo: z.string().trim().max(2000).optional().or(z.literal("")),
  floorId: z.string().uuid().optional(),
  unitId: optionalUnitId,
  serialNumber: z.string().trim().max(200).optional().or(z.literal("")),
  purchaseDate: optionalIsoDate,
});

export const bulkStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids array is required").max(1000),
  action: z.enum(["activate", "deactivate"]),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids array is required").max(1000),
});

export const bulkImportAssetsSchema = z.object({
  items: z
    .array(z.record(z.any()))
    .min(1, "items array is required")
    .max(5000, "Maximum 5000 items per import"),
});

export const assetIdParamSchema = z.object({
  id: z.string().uuid("Invalid asset id"),
});

export const assetCodeParamSchema = z.object({
  code: z.string().trim().min(1).max(100),
});

export const propertyAssetParamSchema = z.object({
  propertyId: z.string().uuid("Invalid property id"),
});

export const propertyAssetIdParamSchema = z.object({
  propertyId: z.string().uuid("Invalid property id"),
  id: z.string().uuid("Invalid asset id"),
});

export const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().max(200).optional(),
  status: statusEnum.optional(),
  condition: conditionEnum.optional(),
  categoryId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
});
