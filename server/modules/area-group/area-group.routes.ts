import { Router } from "express";
import { areaGroupController } from "./area-group.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const areaGroupRoutes = Router();

areaGroupRoutes.use(authenticate);

areaGroupRoutes.get("/", requirePermission(PERMISSIONS.SETTINGS.AREA_GROUPS_MANAGE), areaGroupController.findAll);
areaGroupRoutes.put("/", requirePermission(PERMISSIONS.SETTINGS.AREA_GROUPS_MANAGE), areaGroupController.upsert);
