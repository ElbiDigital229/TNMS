import { z } from "zod";

// Property create/update come in as multipart/form-data (because they
// can carry an image). Multer populates req.body with STRING fields for
// every text input, so the schemas below accept strings and coerce the
// numeric fields. Enum values are validated against the Prisma enum set.

const propertyTypeEnum = z.enum(["FLOOR", "BUILDING", "COMPOUND"]);
const cityEnum = z.enum(["LAHORE", "ISLAMABAD"]);
const statusEnum = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]);

// Multipart booleans arrive as strings ("true" / "false"). Normalize.
const stringBool = z
  .union([z.boolean(), z.literal("true"), z.literal("false")])
  .transform((v) => v === true || v === "true");

// Multipart numbers arrive as strings too; coerce but allow empty → undefined.
const optionalFloat = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  });

export const createPropertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  type: propertyTypeEnum,
  city: cityEnum,
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  latitude: optionalFloat.refine(
    (v) => v === undefined || (v >= -90 && v <= 90),
    { message: "Latitude must be between -90 and 90" },
  ),
  longitude: optionalFloat.refine(
    (v) => v === undefined || (v >= -180 && v <= 180),
    { message: "Longitude must be between -180 and 180" },
  ),
  areaGroupId: z.string().uuid().optional().or(z.literal("")),
});

export const updatePropertySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: propertyTypeEnum.optional(),
  city: cityEnum.optional(),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  latitude: optionalFloat.refine(
    (v) => v === undefined || (v >= -90 && v <= 90),
    { message: "Latitude must be between -90 and 90" },
  ),
  longitude: optionalFloat.refine(
    (v) => v === undefined || (v >= -180 && v <= 180),
    { message: "Longitude must be between -180 and 180" },
  ),
  areaGroupId: z.string().uuid().optional().or(z.literal("")),
  removeImage: stringBool.optional(),
});

export const propertyIdParamSchema = z.object({
  id: z.string().uuid("Invalid property id"),
});

export const listPropertiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().trim().max(200).optional(),
  city: cityEnum.optional(),
  type: propertyTypeEnum.optional(),
  status: statusEnum.optional(),
  areaGroupId: z.string().uuid().optional(),
});
