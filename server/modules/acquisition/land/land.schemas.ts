import { z } from "zod";

const zoningEnum = z.enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE"]);
const proposedModelEnum = z.enum(["JV", "DEVELOPMENT", "SALE"]);
const stageEnum = z.enum(["REVIEW", "VISIT", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"]);
const statusEnum = z.enum(["ACTIVE", "INACTIVE"]);
const utilityEnum = z.enum([
  "WATER",
  "GAS",
  "ELECTRICITY",
  "SEWERAGE",
  "INTERNET",
  "PHONE",
  "BOREWELL",
  "SOLAR",
]);

const optionalString = z.string().trim().max(2000).optional().nullable().or(z.literal(""));
const optionalDate = z
  .union([z.string().datetime(), z.string().date(), z.literal("")])
  .optional()
  .nullable();

/**
 * Accept number, numeric string, or empty — coerce to a non-negative number.
 * Rejects negative values, since none of the size/price fields they decorate
 * (plot area, road width, asking price, etc.) make business sense as negative.
 */
const nonNegativeDecimal = z.preprocess(
  (v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    if (typeof v === "string") {
      const n = parseFloat(v.replace(/,/g, ""));
      return Number.isNaN(n) ? v : n;
    }
    return v;
  },
  z.number().nonnegative("Must be zero or greater").optional(),
);

export const createLandSchema = z.object({
  agentId: z.string().uuid().optional().nullable().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(100),
  areaLocation: optionalString,
  addressDescription: optionalString,
  coordinates: optionalString,
  plotSizeKanal: nonNegativeDecimal,
  frontRoadWidthFt: nonNegativeDecimal,
  zoning: zoningEnum.optional().nullable().or(z.literal("")),
  developmentStatus: optionalString,
  maxCoveredAreaSqft: nonNegativeDecimal,
  utilities: z.array(utilityEnum).optional(),
  parkingPotential: optionalString,
  proposedModel: proposedModelEnum.optional().nullable().or(z.literal("")),
  askingPrice: nonNegativeDecimal,
  ownerFlexibility: optionalString,
  stage: stageEnum.optional(),
  status: statusEnum.optional(),
  lastAvailabilityCheck: optionalDate,
  notes: optionalString,
});

export const updateLandSchema = createLandSchema.partial();

export const landIdParamSchema = z.object({
  id: z.string().uuid("Invalid land id"),
});

export const listLandQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().optional(),
  agentId: z.string().uuid().optional(),
  status: statusEnum.optional(),
  stage: stageEnum.optional(),
  zoning: zoningEnum.optional(),
  city: z.string().trim().optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

export const bulkImportLandSchema = z.object({
  items: z
    .array(z.record(z.any()))
    .min(1, "items array is required")
    .max(5000, "Maximum 5000 items per import"),
});
