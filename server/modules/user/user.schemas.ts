import { z } from "zod";

const statusEnum = z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]);

// Email validation — also allow empty strings coming from the UI because
// some forms send "" for cleared optional fields; we'll normalize downstream.
const optionalEmail = z
  .union([z.string().email("Invalid email"), z.literal("")])
  .optional();

const optionalPhone = z
  .union([z.string().trim().max(30), z.literal("")])
  .optional();

export const createUserSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  employeeCode: z.string().trim().max(50).optional(),
  designationId: z.string().uuid().optional().nullable().or(z.literal("")),
  email: z.string().email("Invalid email"),
  phone: optionalPhone,
  roleId: z.string().uuid("Invalid roleId"),
  departmentId: z.string().uuid("Invalid departmentId"),
  allProperties: z.boolean().optional(),
  propertyIds: z.array(z.string().uuid()).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .optional(),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().max(200).optional(),
  employeeCode: z.string().trim().max(50).optional().nullable(),
  designationId: z.string().uuid().optional().nullable().or(z.literal("")),
  email: optionalEmail,
  phone: optionalPhone,
  roleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional().nullable().or(z.literal("")),
  allProperties: z.boolean().optional(),
  propertyIds: z.array(z.string().uuid()).optional(),
});

export const updateUserPropertiesSchema = z.object({
  propertyIds: z.array(z.string().uuid()),
});

export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200),
});

export const bulkImportUsersSchema = z.object({
  items: z
    .array(z.record(z.any()))
    .min(1, "items array is required")
    .max(5000, "Maximum 5000 items per import"),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user id"),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().max(200).optional(),
  roleId: z.string().uuid().optional(),
  status: statusEnum.optional(),
});
