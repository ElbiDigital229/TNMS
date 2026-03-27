import { Router } from "express";
import { auditController } from "./audit.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const auditRoutes = Router();

auditRoutes.use(authenticate);

auditRoutes.get("/", requirePermission(PERMISSIONS.AUDIT.VIEW), auditController.findAll);
auditRoutes.get("/export", requirePermission(PERMISSIONS.AUDIT.EXPORT), auditController.exportLogs);
