import { Router } from "express";
import { roleController } from "./role.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  listRolesQuerySchema,
} from "./role.schemas.js";

export const roleRoutes = Router();

roleRoutes.use(authenticate);

roleRoutes.get(
  "/",
  requirePermission(PERMISSIONS.ROLES.VIEW),
  validate({ query: listRolesQuerySchema }),
  roleController.findAll,
);
roleRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.ROLES.VIEW),
  validate({ params: roleIdParamSchema }),
  roleController.findById,
);
roleRoutes.post(
  "/",
  requirePermission(PERMISSIONS.ROLES.MANAGE),
  validate({ body: createRoleSchema }),
  roleController.create,
);
roleRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.ROLES.MANAGE),
  validate({ params: roleIdParamSchema, body: updateRoleSchema }),
  roleController.update,
);
roleRoutes.patch(
  "/:id/deactivate",
  requirePermission(PERMISSIONS.ROLES.MANAGE),
  validate({ params: roleIdParamSchema }),
  roleController.deactivate,
);
roleRoutes.patch(
  "/:id/activate",
  requirePermission(PERMISSIONS.ROLES.MANAGE),
  validate({ params: roleIdParamSchema }),
  roleController.activate,
);
