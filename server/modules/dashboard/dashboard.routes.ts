import { Router } from "express";
import { dashboardController } from "./dashboard.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate);

dashboardRoutes.get("/stats", requirePermission(PERMISSIONS.DASHBOARD.VIEW), dashboardController.getStats);
