import { Router } from "express";
import { landController } from "./land.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requirePermission } from "../../../middleware/authorize.js";
import { validate } from "../../../middleware/validate.js";
import { PERMISSIONS } from "../../../../shared/permissions.js";
import {
  createLandSchema,
  updateLandSchema,
  landIdParamSchema,
  listLandQuerySchema,
  bulkImportLandSchema,
} from "./land.schemas.js";

export const acquisitionLandRoutes = Router();
acquisitionLandRoutes.use(authenticate);

acquisitionLandRoutes.get(
  "/",
  requirePermission(PERMISSIONS.ACQUISITIONS.VIEW),
  validate({ query: listLandQuerySchema }),
  landController.findAll,
);

acquisitionLandRoutes.get(
  "/export.csv",
  requirePermission(PERMISSIONS.ACQUISITIONS.EXPORT),
  validate({ query: listLandQuerySchema }),
  landController.exportCsv,
);

acquisitionLandRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.VIEW),
  validate({ params: landIdParamSchema }),
  landController.findById,
);

acquisitionLandRoutes.post(
  "/",
  requirePermission(PERMISSIONS.ACQUISITIONS.CREATE),
  validate({ body: createLandSchema }),
  landController.create,
);

acquisitionLandRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.EDIT),
  validate({ params: landIdParamSchema, body: updateLandSchema }),
  landController.update,
);

acquisitionLandRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.DELETE),
  validate({ params: landIdParamSchema }),
  landController.softDelete,
);

acquisitionLandRoutes.patch(
  "/:id/restore",
  requirePermission(PERMISSIONS.ACQUISITIONS.DELETE),
  validate({ params: landIdParamSchema }),
  landController.restore,
);

acquisitionLandRoutes.post(
  "/import",
  requirePermission(PERMISSIONS.ACQUISITIONS.IMPORT),
  validate({ body: bulkImportLandSchema }),
  landController.bulkImport,
);
