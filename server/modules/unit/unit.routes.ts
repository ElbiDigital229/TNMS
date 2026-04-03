import { Router } from "express";
import { unitController } from "./unit.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const unitRoutes = Router();

unitRoutes.use(authenticate);

unitRoutes.get("/:propertyId/units", requirePermission(PERMISSIONS.UNITS.VIEW), unitController.findByProperty);
unitRoutes.post("/:propertyId/units", requirePermission(PERMISSIONS.UNITS.CREATE), unitController.create);
unitRoutes.post("/:propertyId/units/bulk-import", requirePermission(PERMISSIONS.UNITS.IMPORT), unitController.bulkImport);
unitRoutes.post("/units/bulk-delete", requirePermission(PERMISSIONS.UNITS.DEACTIVATE), unitController.bulkDelete);
unitRoutes.put("/units/:id", requirePermission(PERMISSIONS.UNITS.EDIT), unitController.update);
unitRoutes.patch("/units/:id/deactivate", requirePermission(PERMISSIONS.UNITS.DEACTIVATE), unitController.deactivate);
unitRoutes.patch("/units/:id/activate", requirePermission(PERMISSIONS.UNITS.DEACTIVATE), unitController.activate);


// Global unit routes (mounted under /api/units)
export const unitGlobalRoutes = Router();
unitGlobalRoutes.get("/", authenticate, requirePermission(PERMISSIONS.UNITS.VIEW), unitController.findAll);
