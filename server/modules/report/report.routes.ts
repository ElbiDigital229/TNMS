import { Router } from "express";
import { reportController } from "./report.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const reportRoutes = Router();
reportRoutes.use(authenticate);

reportRoutes.post("/query", requirePermission(PERMISSIONS.REPORTS.VIEW), reportController.runQuery);
