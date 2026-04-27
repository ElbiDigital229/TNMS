import { z } from "zod";

// Ticket create/update come in as multipart/form-data (can carry images).
// Fields arrive as strings; the schemas below coerce/parse where needed.
// Enums are validated against the Prisma enum set so the DB never sees a
// bad value.

const priorityEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
const statusEnum = z.enum([
  "UNASSIGNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETED",
]);
const taskTypeEnum = z.enum(["COMPLAIN", "MAINTENANCE", "INSPECT", "TASK"]);
const subTaskTypeEnum = z.enum(["REACTIVE", "PREVENTIVE"]);
// Optional int coerced from string, empty → undefined.
const optionalInt = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  });

// assetIds: JSON-stringified array, native array, or empty.
const assetIdsField = z
  .union([z.string(), z.array(z.string().uuid())])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    if (Array.isArray(v)) return v;
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string");
    } catch {
      return undefined;
    }
    return undefined;
  });

// dueDate: accept ISO string or empty.
const optionalIsoDate = z
  .string()
  .optional()
  .refine(
    (v) => v === undefined || v === "" || !Number.isNaN(Date.parse(v)),
    { message: "Invalid date" },
  )
  .transform((v) => (v === undefined || v === "" ? undefined : v));

export const createTicketSchema = z.object({
  name: z.string().trim().min(1, "Title is required").max(300),
  description: z.string().trim().min(1, "Description is required").max(5000),
  propertyId: z.string().uuid("Invalid propertyId"),
  unitId: z.string().uuid().optional().or(z.literal("")),
  dueDate: optionalIsoDate,
  taskType: taskTypeEnum.optional(),
  subTaskType: subTaskTypeEnum.optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  departmentId: z.string().uuid("Department is required"),
  assignedToId: z.string().uuid().optional().or(z.literal("")),
  priority: priorityEnum.optional(),
  assetIds: assetIdsField,
});

export const updateTicketSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  unitId: z.string().uuid().optional().or(z.literal("")).nullable(),
  dueDate: optionalIsoDate,
  taskType: taskTypeEnum.optional(),
  subTaskType: subTaskTypeEnum.optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")).nullable(),
  departmentId: z.string().uuid("Invalid departmentId").optional(),
  priority: priorityEnum.optional(),
  assetIds: assetIdsField,
});

export const updateStatusSchema = z.object({
  status: statusEnum,
});

export const addCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment is required").max(5000),
});

export const assignSchema = z.object({
  assigneeId: z.string().uuid("Invalid assigneeId"),
});

export const blockTicketSchema = z.object({
  blockingUserId: z.string().uuid().optional().or(z.literal("")),
  departmentId: z.string().uuid("Invalid departmentId"),
  reason: z.string().trim().min(1, "Reason is required").max(1000),
});

export const unblockTicketSchema = z.object({
  resolvedNote: z.string().trim().max(1000).optional(),
});

export const deleteImageSchema = z.object({
  imagePath: z.string().min(1, "imagePath is required").max(500),
});

export const bulkImportSchema = z.object({
  items: z
    .array(z.record(z.any()))
    .min(1, "items array is required")
    .max(5000, "Maximum 5000 tickets per import"),
});

export const ticketIdParamSchema = z.object({
  id: z.string().uuid("Invalid ticket id"),
});

export const ticketCommentParamSchema = z.object({
  id: z.string().uuid("Invalid ticket id"),
  commentId: z.string().uuid("Invalid comment id"),
});

// CSV-safe string: accept single value or comma-separated values
const csvString = z.string().max(2000).optional();

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  search: z.string().max(200).optional(),
  status: csvString,
  priority: csvString,
  taskType: csvString,
  propertyId: csvString,
  assigneeId: z.string().uuid().optional(),
  createdById: z.string().uuid().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  blocked: z.string().optional(),
  overdue: z.string().optional(),
  legacy: z.string().optional(),
  deleted: z.string().optional(),
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
