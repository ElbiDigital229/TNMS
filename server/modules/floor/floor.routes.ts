import { Router } from "express";
import { z } from "zod";
import { floorController } from "./floor.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  nameOnlyBodySchema,
  uuidIdParamSchema,
} from "../../middleware/commonSchemas.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

const propertyIdParamSchema = z.object({
  propertyId: z.string().uuid("Invalid property id"),
});

const bulkImportSchema = z.object({
  items: z.array(z.record(z.any())).min(1).max(5000),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
});

export const floorRoutes = Router();

floorRoutes.use(authenticate);

floorRoutes.get(
  "/:propertyId/floors",
  requirePermission(PERMISSIONS.FLOORS.VIEW),
  validate({ params: propertyIdParamSchema }),
  floorController.findByProperty,
);
floorRoutes.post(
  "/:propertyId/floors",
  requirePermission(PERMISSIONS.FLOORS.CREATE),
  validate({ params: propertyIdParamSchema, body: nameOnlyBodySchema }),
  floorController.create,
);
floorRoutes.post(
  "/:propertyId/floors/bulk-import",
  requirePermission(PERMISSIONS.FLOORS.IMPORT),
  validate({ params: propertyIdParamSchema, body: bulkImportSchema }),
  floorController.bulkImport,
);
floorRoutes.delete(
  "/floors/bulk-delete",
  requirePermission(PERMISSIONS.FLOORS.DELETE),
  validate({ body: bulkDeleteSchema }),
  floorController.bulkDelete,
);
floorRoutes.put(
  "/floors/:id",
  requirePermission(PERMISSIONS.FLOORS.EDIT),
  validate({ params: uuidIdParamSchema, body: nameOnlyBodySchema }),
  floorController.update,
);
floorRoutes.patch(
  "/floors/:id/deactivate",
  requirePermission(PERMISSIONS.FLOORS.DEACTIVATE),
  validate({ params: uuidIdParamSchema }),
  floorController.deactivate,
);
floorRoutes.patch(
  "/floors/:id/activate",
  requirePermission(PERMISSIONS.FLOORS.DEACTIVATE),
  validate({ params: uuidIdParamSchema }),
  floorController.activate,
);
