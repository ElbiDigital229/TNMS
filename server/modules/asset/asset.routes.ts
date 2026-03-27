import { Router } from "express";
import { assetController } from "./asset.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import { uploadSingle } from "../../middleware/upload.js";

export const assetRoutes = Router();

// All asset routes are protected
assetRoutes.get("/", authenticate, requirePermission(PERMISSIONS.ASSETS.VIEW), assetController.findAll);
assetRoutes.get("/code/:code", assetController.findByCode);

// Protected routes
assetRoutes.get("/:id", authenticate, requirePermission(PERMISSIONS.ASSETS.VIEW), assetController.findById);
assetRoutes.put("/:id", authenticate, requirePermission(PERMISSIONS.ASSETS.EDIT), uploadSingle, assetController.update);
assetRoutes.patch("/:id/deactivate", authenticate, requirePermission(PERMISSIONS.ASSETS.DEACTIVATE), assetController.deactivate);
assetRoutes.patch("/:id/activate", authenticate, requirePermission(PERMISSIONS.ASSETS.DEACTIVATE), assetController.activate);

// Property-scoped asset routes (mounted under /api/properties)
export const propertyAssetRoutes = Router();
propertyAssetRoutes.use(authenticate);
propertyAssetRoutes.get("/:propertyId/assets", assetController.findByProperty);
propertyAssetRoutes.post("/:propertyId/assets", requirePermission(PERMISSIONS.ASSETS.CREATE), uploadSingle, assetController.create);
