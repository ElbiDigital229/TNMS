import { Router } from "express";
import { reportController } from "./report.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const reportRoutes = Router();
reportRoutes.use(authenticate);

reportRoutes.get("/dashboard", requirePermission(PERMISSIONS.REPORTS.VIEW), reportController.getDashboard);
reportRoutes.post("/query", requirePermission(PERMISSIONS.REPORTS.VIEW), reportController.runQuery);
reportRoutes.get("/entity/user/:userId",             requirePermission(PERMISSIONS.REPORTS.VIEW), reportController.getUserReport);
reportRoutes.get("/entity/department/:departmentId", requirePermission(PERMISSIONS.REPORTS.VIEW), reportController.getDepartmentReport);
reportRoutes.get("/entity/property/:propertyId",     requirePermission(PERMISSIONS.REPORTS.VIEW), reportController.getPropertyReport);
reportRoutes.get("/entity/asset/:assetId",           requirePermission(PERMISSIONS.REPORTS.VIEW), reportController.getAssetReport);
