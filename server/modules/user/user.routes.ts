import { Router } from "express";
import { userController } from "./user.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const userRoutes = Router();

userRoutes.use(authenticate);

userRoutes.get("/", requirePermission(PERMISSIONS.USERS.VIEW), userController.findAll);
userRoutes.post("/", requirePermission(PERMISSIONS.USERS.CREATE), userController.create);
userRoutes.get("/:id/subordinates", requirePermission(PERMISSIONS.USERS.VIEW), userController.getSubordinates);
userRoutes.get("/:id/properties", requirePermission(PERMISSIONS.USERS.VIEW), userController.getManagerProperties);
userRoutes.get("/:id", requirePermission(PERMISSIONS.USERS.VIEW), userController.findById);
userRoutes.put("/:id/properties", requirePermission(PERMISSIONS.USERS.EDIT), userController.updateProperties);
userRoutes.put("/:id", requirePermission(PERMISSIONS.USERS.EDIT), userController.update);
userRoutes.patch("/:id/password", requirePermission(PERMISSIONS.USERS.EDIT), userController.resetPassword);
userRoutes.patch("/:id/deactivate", requirePermission(PERMISSIONS.USERS.DEACTIVATE), userController.deactivate);
userRoutes.patch("/:id/block", requirePermission(PERMISSIONS.USERS.DEACTIVATE), userController.block);
userRoutes.patch("/:id/activate", requirePermission(PERMISSIONS.USERS.DEACTIVATE), userController.activate);
