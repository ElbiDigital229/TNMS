import { z } from "zod";

const buildingStatusEnum = z.enum(["READY", "UNDER_CONSTRUCTION"]);
const proposedModelEnum = z.enum(["LEASE", "JV", "OPERATOR"]);
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
const optionalDecimal = z.union([z.number(), z.string()]).optional().nullable().or(z.literal(""));
const optionalInt = z.union([z.number().int(), z.string()]).optional().nullable().or(z.literal(""));
const optionalDate = z
  .union([z.string().datetime(), z.string().date(), z.literal("")])
  .optional()
  .nullable();

export const createBuildingSchema = z.object({
  agentId: z.string().uuid().optional().nullable().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(100),
  areaLocation: optionalString,
  propertyAddress: optionalString,
  coordinates: optionalString,
  coveredAreaSqft: optionalDecimal,
  plotSizeKanal: optionalDecimal,
  floors: optionalInt,
  floorPlateSizeSqft: optionalDecimal,
  parkingCapacity: optionalInt,
  buildingStatus: buildingStatusEnum.optional().nullable().or(z.literal("")),
  possessionTimeline: optionalString,
  utilities: z.array(utilityEnum).optional(),
  powerBackup: optionalString,
  elevators: optionalInt,
  proposedModel: proposedModelEnum.optional().nullable().or(z.literal("")),
  askingRent: optionalDecimal,
  stage: stageEnum.optional(),
  status: statusEnum.optional(),
  lastAvailabilityCheck: optionalDate,
  notes: optionalString,
});

export const updateBuildingSchema = createBuildingSchema.partial();

export const buildingIdParamSchema = z.object({
  id: z.string().uuid("Invalid building id"),
});

export const listBuildingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().optional(),
  agentId: z.string().uuid().optional(),
  status: statusEnum.optional(),
  stage: stageEnum.optional(),
  buildingStatus: buildingStatusEnum.optional(),
  city: z.string().trim().optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

export const bulkImportBuildingSchema = z.object({
  items: z
    .array(z.record(z.any()))
    .min(1, "items array is required")
    .max(5000, "Maximum 5000 items per import"),
});
