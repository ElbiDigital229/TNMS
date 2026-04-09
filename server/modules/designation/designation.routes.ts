import { Router } from "express";
import { designationController } from "./designation.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  nameOnlyBodySchema,
  uuidIdParamSchema,
} from "../../middleware/commonSchemas.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const designationRoutes = Router();
designationRoutes.use(authenticate);

designationRoutes.get("/", designationController.findAll);
designationRoutes.post(
  "/",
  requirePermission(PERMISSIONS.SETTINGS.DESIGNATIONS_MANAGE),
  validate({ body: nameOnlyBodySchema }),
  designationController.create,
);
designationRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.SETTINGS.DESIGNATIONS_MANAGE),
  validate({ params: uuidIdParamSchema, body: nameOnlyBodySchema }),
  designationController.update,
);
designationRoutes.patch(
  "/:id/deactivate",
  requirePermission(PERMISSIONS.SETTINGS.DESIGNATIONS_MANAGE),
  validate({ params: uuidIdParamSchema }),
  designationController.deactivate,
);
designationRoutes.patch(
  "/:id/activate",
  requirePermission(PERMISSIONS.SETTINGS.DESIGNATIONS_MANAGE),
  validate({ params: uuidIdParamSchema }),
  designationController.activate,
);
