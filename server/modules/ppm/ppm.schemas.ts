import { z } from "zod";

const stepSchema = z.object({
  text: z.string().trim().min(1, "Step text is required").max(500),
});

export const createPpmSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  steps: z.array(stepSchema).min(1, "At least one step is required"),
});

export const updatePpmSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  steps: z.array(stepSchema).min(1).optional(),
});

export const ppmIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const listPpmsQuerySchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  search: z.string().max(200).optional(),
});

export const updateStepStatusSchema = z.object({
  status: z.enum(["PENDING", "OK", "NOT_OK", "NA"]),
  remarks: z.string().max(2000).optional().nullable(),
});
