import { Router } from "express";
import { propertyController } from "./property.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { uploadSingle } from "../../middleware/upload.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const propertyRoutes = Router();

propertyRoutes.use(authenticate);

propertyRoutes.get("/export", requirePermission(PERMISSIONS.PROPERTIES.EXPORT), propertyController.exportCsv);
propertyRoutes.get("/", requirePermission(PERMISSIONS.PROPERTIES.VIEW), propertyController.findAll);
propertyRoutes.get("/:id", requirePermission(PERMISSIONS.PROPERTIES.VIEW), propertyController.findById);
propertyRoutes.post("/", requirePermission(PERMISSIONS.PROPERTIES.CREATE), uploadSingle, propertyController.create);
propertyRoutes.put("/:id", requirePermission(PERMISSIONS.PROPERTIES.EDIT), uploadSingle, propertyController.update);
propertyRoutes.patch("/:id/deactivate", requirePermission(PERMISSIONS.PROPERTIES.DEACTIVATE), propertyController.deactivate);
propertyRoutes.patch("/:id/activate", requirePermission(PERMISSIONS.PROPERTIES.DEACTIVATE), propertyController.activate);
