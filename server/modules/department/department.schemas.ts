import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  headUserId: z.string().uuid().optional().nullable().or(z.literal("")),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  headUserId: z.string().uuid().optional().nullable().or(z.literal("")),
});

export const departmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid department id"),
});
