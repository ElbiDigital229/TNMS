import { Router } from "express";
import { buildingController } from "./building.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requirePermission } from "../../../middleware/authorize.js";
import { validate } from "../../../middleware/validate.js";
import { PERMISSIONS } from "../../../../shared/permissions.js";
import {
  createBuildingSchema,
  updateBuildingSchema,
  buildingIdParamSchema,
  listBuildingQuerySchema,
  bulkImportBuildingSchema,
} from "./building.schemas.js";

export const acquisitionBuildingRoutes = Router();
acquisitionBuildingRoutes.use(authenticate);

acquisitionBuildingRoutes.get(
  "/",
  requirePermission(PERMISSIONS.ACQUISITIONS.VIEW),
  validate({ query: listBuildingQuerySchema }),
  buildingController.findAll,
);

acquisitionBuildingRoutes.get(
  "/export.csv",
  requirePermission(PERMISSIONS.ACQUISITIONS.EXPORT),
  validate({ query: listBuildingQuerySchema }),
  buildingController.exportCsv,
);

acquisitionBuildingRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.VIEW),
  validate({ params: buildingIdParamSchema }),
  buildingController.findById,
);

acquisitionBuildingRoutes.post(
  "/",
  requirePermission(PERMISSIONS.ACQUISITIONS.CREATE),
  validate({ body: createBuildingSchema }),
  buildingController.create,
);

acquisitionBuildingRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.EDIT),
  validate({ params: buildingIdParamSchema, body: updateBuildingSchema }),
  buildingController.update,
);

acquisitionBuildingRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.DELETE),
  validate({ params: buildingIdParamSchema }),
  buildingController.softDelete,
);

acquisitionBuildingRoutes.patch(
  "/:id/restore",
  requirePermission(PERMISSIONS.ACQUISITIONS.DELETE),
  validate({ params: buildingIdParamSchema }),
  buildingController.restore,
);

acquisitionBuildingRoutes.post(
  "/import",
  requirePermission(PERMISSIONS.ACQUISITIONS.IMPORT),
  validate({ body: bulkImportBuildingSchema }),
  buildingController.bulkImport,
);
