import { z } from "zod";

const uuidOrNullable = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .or(z.literal(""));

const frequencyEnum = z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]);
const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const taskTypeEnum = z.enum(["INSPECTION", "MAINTENANCE", "REPAIR", "CLEANING", "OTHER"]);
const subTaskTypeEnum = z.enum(["PREVENTIVE", "CORRECTIVE", "ROUTINE", "EMERGENCY"]);

export const createTicketScheduleSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(300),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  propertyId: z.string().uuid("Invalid property id"),
  unitId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  assignedToId: z.string().uuid().optional().or(z.literal("")),
  priority: priorityEnum.optional(),
  taskType: taskTypeEnum,
  subTaskType: subTaskTypeEnum.optional(),
  frequency: frequencyEnum,
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
});

export const updateTicketScheduleSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  propertyId: z.string().uuid().optional(),
  unitId: uuidOrNullable,
  categoryId: uuidOrNullable,
  departmentId: uuidOrNullable,
  assignedToId: uuidOrNullable,
  priority: priorityEnum.optional(),
  taskType: taskTypeEnum.optional(),
  subTaskType: subTaskTypeEnum.optional(),
  frequency: frequencyEnum.optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.number().int().min(1).max(12).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const listTicketSchedulesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  propertyId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});
