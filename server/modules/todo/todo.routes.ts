import { Router } from "express";
import { z } from "zod";
import { todoController } from "./todo.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { uuidIdParamSchema } from "../../middleware/commonSchemas.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

const createTodoSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  dueDate: z
    .string()
    .min(1, "Due date is required")
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" }),
});

const listTodosQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "all"]).optional(),
  status: z.enum(["OPEN", "COMPLETED", "all"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const router = Router();

router.use(authenticate);
router.use(requirePermission(PERMISSIONS.TODOS.ACCESS));

router.get("/", validate({ query: listTodosQuerySchema }), todoController.findAll);
router.get("/stats", todoController.getStats);
router.post("/", validate({ body: createTodoSchema }), todoController.create);
const updateTodoSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  dueDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
    .optional(),
});

router.put(
  "/:id",
  validate({ params: uuidIdParamSchema, body: updateTodoSchema }),
  todoController.update,
);
router.patch(
  "/:id/complete",
  validate({ params: uuidIdParamSchema }),
  todoController.complete,
);
router.patch(
  "/:id/reopen",
  validate({ params: uuidIdParamSchema }),
  todoController.reopen,
);
router.delete(
  "/:id",
  validate({ params: uuidIdParamSchema }),
  todoController.remove,
);

export const todoRoutes = router;
