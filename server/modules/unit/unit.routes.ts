import { Router } from "express";
import { unitController } from "./unit.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { uuidIdParamSchema } from "../../middleware/commonSchemas.js";
import {
  createUnitSchema,
  updateUnitSchema,
  propertyUnitParamSchema,
  bulkDeleteUnitsSchema,
  bulkImportUnitsSchema,
  listUnitsQuerySchema,
} from "./unit.schemas.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const unitRoutes = Router();

unitRoutes.use(authenticate);

unitRoutes.get(
  "/:propertyId/units",
  requirePermission(PERMISSIONS.UNITS.VIEW),
  validate({ params: propertyUnitParamSchema }),
  unitController.findByProperty,
);
unitRoutes.post(
  "/:propertyId/units",
  requirePermission(PERMISSIONS.UNITS.CREATE),
  validate({ params: propertyUnitParamSchema, body: createUnitSchema }),
  unitController.create,
);
unitRoutes.post(
  "/:propertyId/units/bulk-import",
  requirePermission(PERMISSIONS.UNITS.IMPORT),
  validate({ params: propertyUnitParamSchema, body: bulkImportUnitsSchema }),
  unitController.bulkImport,
);
unitRoutes.post(
  "/units/bulk-delete",
  requirePermission(PERMISSIONS.UNITS.DEACTIVATE),
  validate({ body: bulkDeleteUnitsSchema }),
  unitController.bulkDelete,
);
unitRoutes.put(
  "/units/:id",
  requirePermission(PERMISSIONS.UNITS.EDIT),
  validate({ params: uuidIdParamSchema, body: updateUnitSchema }),
  unitController.update,
);
unitRoutes.patch(
  "/units/:id/deactivate",
  requirePermission(PERMISSIONS.UNITS.DEACTIVATE),
  validate({ params: uuidIdParamSchema }),
  unitController.deactivate,
);
unitRoutes.patch(
  "/units/:id/activate",
  requirePermission(PERMISSIONS.UNITS.DEACTIVATE),
  validate({ params: uuidIdParamSchema }),
  unitController.activate,
);

// Global unit routes (mounted under /api/units)
export const unitGlobalRoutes = Router();
unitGlobalRoutes.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.UNITS.VIEW),
  validate({ query: listUnitsQuerySchema }),
  unitController.findAll,
);
