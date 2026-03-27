import { Router } from "express";
import { assetCategoryController } from "./asset-category.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const assetCategoryRoutes = Router();

assetCategoryRoutes.use(authenticate);

assetCategoryRoutes.get("/", assetCategoryController.findAll);
assetCategoryRoutes.post("/", requirePermission(PERMISSIONS.SETTINGS.ASSET_CATEGORIES_MANAGE), assetCategoryController.create);
assetCategoryRoutes.put("/:id", requirePermission(PERMISSIONS.SETTINGS.ASSET_CATEGORIES_MANAGE), assetCategoryController.update);
assetCategoryRoutes.patch("/:id/deactivate", requirePermission(PERMISSIONS.SETTINGS.ASSET_CATEGORIES_MANAGE), assetCategoryController.deactivate);
assetCategoryRoutes.patch("/:id/activate", requirePermission(PERMISSIONS.SETTINGS.ASSET_CATEGORIES_MANAGE), assetCategoryController.activate);
