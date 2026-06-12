import { z } from "zod";

const sourceTypeEnum = z.enum(["BROKER", "OWNER", "CONSULTANT"]);
const statusEnum = z.enum(["ACTIVE", "INACTIVE"]);

const optionalString = z.string().trim().max(500).optional().nullable().or(z.literal(""));
const optionalEmail = z.union([z.string().email("Invalid email"), z.literal("")]).optional().nullable();
const optionalDate = z
  .union([z.string().datetime(), z.string().date(), z.literal("")])
  .optional()
  .nullable();

export const createAgentSchema = z.object({
  agentName: z.string().trim().min(1, "Agent name is required").max(200),
  companyName: optionalString,
  contactNumber: z.string().trim().min(1, "Contact number is required").max(50),
  email: optionalEmail,
  city: z.string().trim().min(1, "City is required").max(100),
  areaFocus: optionalString,
  sourceType: sourceTypeEnum,
  rating: z.number().int().min(1).max(5).optional(),
  firstContactDate: optionalDate,
  status: statusEnum.optional(),
  lastAvailabilityCheck: optionalDate,
  notes: optionalString,
});

export const updateAgentSchema = createAgentSchema.partial();

export const agentIdParamSchema = z.object({
  id: z.string().uuid("Invalid agent id"),
});

export const listAgentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  search: z.string().trim().optional(),
  status: statusEnum.optional(),
  sourceType: sourceTypeEnum.optional(),
  city: z.string().trim().optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

export const bulkImportAgentsSchema = z.object({
  items: z
    .array(z.record(z.any()))
    .min(1, "items array is required")
    .max(5000, "Maximum 5000 items per import"),
});
