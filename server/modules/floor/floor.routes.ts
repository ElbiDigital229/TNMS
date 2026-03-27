import { Router } from "express";
import { floorController } from "./floor.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const floorRoutes = Router();

floorRoutes.use(authenticate);

floorRoutes.get("/:propertyId/floors", requirePermission(PERMISSIONS.FLOORS.VIEW), floorController.findByProperty);
floorRoutes.post("/:propertyId/floors", requirePermission(PERMISSIONS.FLOORS.CREATE), floorController.create);
floorRoutes.put("/floors/:id", requirePermission(PERMISSIONS.FLOORS.EDIT), floorController.update);
floorRoutes.patch("/floors/:id/deactivate", requirePermission(PERMISSIONS.FLOORS.DEACTIVATE), floorController.deactivate);
floorRoutes.patch("/floors/:id/activate", requirePermission(PERMISSIONS.FLOORS.DEACTIVATE), floorController.activate);
