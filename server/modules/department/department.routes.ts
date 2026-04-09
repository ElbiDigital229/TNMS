import { Router } from "express";
import { departmentController } from "./department.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdParamSchema,
} from "./department.schemas.js";

export const departmentRoutes = Router();
departmentRoutes.use(authenticate);

departmentRoutes.get("/", departmentController.findAll);
departmentRoutes.post(
  "/",
  requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE),
  validate({ body: createDepartmentSchema }),
  departmentController.create,
);
departmentRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE),
  validate({ params: departmentIdParamSchema, body: updateDepartmentSchema }),
  departmentController.update,
);
departmentRoutes.patch(
  "/:id/deactivate",
  requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE),
  validate({ params: departmentIdParamSchema }),
  departmentController.deactivate,
);
departmentRoutes.patch(
  "/:id/activate",
  requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE),
  validate({ params: departmentIdParamSchema }),
  departmentController.activate,
);
departmentRoutes.get(
  "/:id/users",
  validate({ params: departmentIdParamSchema }),
  departmentController.getUsers,
);
