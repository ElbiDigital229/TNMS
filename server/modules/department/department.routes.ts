import { Router } from "express";
import { departmentController } from "./department.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const departmentRoutes = Router();
departmentRoutes.use(authenticate);

departmentRoutes.get("/", departmentController.findAll);
departmentRoutes.post("/", requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE), departmentController.create);
departmentRoutes.put("/:id", requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE), departmentController.update);
departmentRoutes.patch("/:id/deactivate", requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE), departmentController.deactivate);
departmentRoutes.patch("/:id/activate", requirePermission(PERMISSIONS.SETTINGS.DEPARTMENTS_MANAGE), departmentController.activate);
departmentRoutes.get("/:id/users", departmentController.getUsers);
