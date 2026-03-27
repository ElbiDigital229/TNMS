import { Router } from "express";
import { roleController } from "./role.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const roleRoutes = Router();

roleRoutes.use(authenticate);

roleRoutes.get("/", requirePermission(PERMISSIONS.ROLES.VIEW), roleController.findAll);
roleRoutes.get("/:id", requirePermission(PERMISSIONS.ROLES.VIEW), roleController.findById);
roleRoutes.post("/", requirePermission(PERMISSIONS.ROLES.MANAGE), roleController.create);
roleRoutes.put("/:id", requirePermission(PERMISSIONS.ROLES.MANAGE), roleController.update);
roleRoutes.patch("/:id/deactivate", requirePermission(PERMISSIONS.ROLES.MANAGE), roleController.deactivate);
roleRoutes.patch("/:id/activate", requirePermission(PERMISSIONS.ROLES.MANAGE), roleController.activate);
