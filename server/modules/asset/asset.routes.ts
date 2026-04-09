import { Router } from "express";
import { assetController } from "./asset.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import { uploadSingle } from "../../middleware/upload.js";
import {
  createAssetSchema,
  updateAssetSchema,
  bulkStatusSchema,
  bulkDeleteSchema,
  bulkImportAssetsSchema,
  assetIdParamSchema,
  assetCodeParamSchema,
  propertyAssetParamSchema,
  listAssetsQuerySchema,
} from "./asset.schemas.js";

export const assetRoutes = Router();

// All asset routes are protected
assetRoutes.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.ASSETS.VIEW),
  validate({ query: listAssetsQuerySchema }),
  assetController.findAll,
);
assetRoutes.post(
  "/bulk-status",
  authenticate,
  requirePermission(PERMISSIONS.ASSETS.DEACTIVATE),
  validate({ body: bulkStatusSchema }),
  assetController.bulkStatus,
);
assetRoutes.get(
  "/code/:code",
  validate({ params: assetCodeParamSchema }),
  assetController.findByCode,
);

// Protected routes
assetRoutes.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.ASSETS.VIEW),
  validate({ params: assetIdParamSchema }),
  assetController.findById,
);
assetRoutes.get(
  "/:id/tickets",
  authenticate,
  requirePermission(PERMISSIONS.ASSETS.VIEW),
  validate({ params: assetIdParamSchema }),
  assetController.findTickets,
);
assetRoutes.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.ASSETS.EDIT),
  uploadSingle,
  validate({ params: assetIdParamSchema, body: updateAssetSchema }),
  assetController.update,
);
assetRoutes.patch(
  "/:id/deactivate",
  authenticate,
  requirePermission(PERMISSIONS.ASSETS.DEACTIVATE),
  validate({ params: assetIdParamSchema }),
  assetController.deactivate,
);
assetRoutes.patch(
  "/:id/activate",
  authenticate,
  requirePermission(PERMISSIONS.ASSETS.DEACTIVATE),
  validate({ params: assetIdParamSchema }),
  assetController.activate,
);

// Property-scoped asset routes (mounted under /api/properties)
export const propertyAssetRoutes = Router();
propertyAssetRoutes.use(authenticate);
propertyAssetRoutes.get(
  "/:propertyId/assets",
  validate({ params: propertyAssetParamSchema }),
  assetController.findByProperty,
);
propertyAssetRoutes.post(
  "/:propertyId/assets",
  requirePermission(PERMISSIONS.ASSETS.CREATE),
  uploadSingle,
  validate({ params: propertyAssetParamSchema, body: createAssetSchema }),
  assetController.create,
);
propertyAssetRoutes.post(
  "/:propertyId/assets/bulk-import",
  requirePermission(PERMISSIONS.ASSETS.IMPORT),
  validate({ params: propertyAssetParamSchema, body: bulkImportAssetsSchema }),
  assetController.bulkImport,
);
propertyAssetRoutes.post(
  "/:propertyId/assets/bulk-delete",
  requirePermission(PERMISSIONS.ASSETS.DEACTIVATE),
  validate({ params: propertyAssetParamSchema, body: bulkDeleteSchema }),
  assetController.bulkDelete,
);
