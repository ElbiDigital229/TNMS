import { Router } from "express";
import { z } from "zod";
import { areaGroupController } from "./area-group.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

const upsertSchema = z.object({
  city: z.enum(["LAHORE", "ISLAMABAD"]),
  groupName: z.string().trim().min(1, "Group name is required").max(100),
});

export const areaGroupRoutes = Router();

areaGroupRoutes.use(authenticate);

areaGroupRoutes.get(
  "/",
  requirePermission(PERMISSIONS.SETTINGS.AREA_GROUPS_MANAGE),
  areaGroupController.findAll,
);
areaGroupRoutes.put(
  "/",
  requirePermission(PERMISSIONS.SETTINGS.AREA_GROUPS_MANAGE),
  validate({ body: upsertSchema }),
  areaGroupController.upsert,
);
