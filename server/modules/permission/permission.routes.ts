import { Router } from "express";
import { permissionController } from "./permission.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const permissionRoutes = Router();

permissionRoutes.use(authenticate);

permissionRoutes.get("/", requirePermission(PERMISSIONS.ROLES.VIEW), permissionController.findAll);
