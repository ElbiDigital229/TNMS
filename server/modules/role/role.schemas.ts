import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  permissionIds: z.array(z.string().uuid()).min(0).max(500),
});

export const updateRoleSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  permissionIds: z.array(z.string().uuid()).min(0).max(500).optional(),
  expectedUpdatedAt: z.string().optional(),
});

export const roleIdParamSchema = z.object({
  id: z.string().uuid("Invalid role id"),
});

export const listRolesQuerySchema = z.object({
  activeOnly: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});
