import { Router } from "express";
import { ppmController } from "./ppm.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import {
  createPpmSchema,
  updatePpmSchema,
  ppmIdParamSchema,
  listPpmsQuerySchema,
} from "./ppm.schemas.js";

export const ppmRoutes = Router();
ppmRoutes.use(authenticate);

ppmRoutes.get(
  "/",
  requirePermission(PERMISSIONS.PPM.VIEW),
  validate({ query: listPpmsQuerySchema }),
  ppmController.findAll,
);
ppmRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.PPM.VIEW),
  validate({ params: ppmIdParamSchema }),
  ppmController.findById,
);
ppmRoutes.post(
  "/",
  requirePermission(PERMISSIONS.PPM.MANAGE),
  validate({ body: createPpmSchema }),
  ppmController.create,
);
ppmRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.PPM.MANAGE),
  validate({ params: ppmIdParamSchema, body: updatePpmSchema }),
  ppmController.update,
);
ppmRoutes.patch(
  "/:id/deactivate",
  requirePermission(PERMISSIONS.PPM.MANAGE),
  validate({ params: ppmIdParamSchema }),
  ppmController.deactivate,
);
ppmRoutes.patch(
  "/:id/activate",
  requirePermission(PERMISSIONS.PPM.MANAGE),
  validate({ params: ppmIdParamSchema }),
  ppmController.activate,
);
