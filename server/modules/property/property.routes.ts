import { Router } from "express";
import { propertyController } from "./property.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { uploadSingle } from "../../middleware/upload.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import {
  createPropertySchema,
  updatePropertySchema,
  propertyIdParamSchema,
  listPropertiesQuerySchema,
} from "./property.schemas.js";

export const propertyRoutes = Router();

propertyRoutes.use(authenticate);

propertyRoutes.get(
  "/export",
  requirePermission(PERMISSIONS.PROPERTIES.EXPORT),
  validate({ query: listPropertiesQuerySchema }),
  propertyController.exportCsv,
);
propertyRoutes.get(
  "/",
  requirePermission(PERMISSIONS.PROPERTIES.VIEW),
  validate({ query: listPropertiesQuerySchema }),
  propertyController.findAll,
);
propertyRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.PROPERTIES.VIEW),
  validate({ params: propertyIdParamSchema }),
  propertyController.findById,
);
propertyRoutes.post(
  "/",
  requirePermission(PERMISSIONS.PROPERTIES.CREATE),
  uploadSingle,
  validate({ body: createPropertySchema }),
  propertyController.create,
);
propertyRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.PROPERTIES.EDIT),
  uploadSingle,
  validate({ params: propertyIdParamSchema, body: updatePropertySchema }),
  propertyController.update,
);
propertyRoutes.patch(
  "/:id/deactivate",
  requirePermission(PERMISSIONS.PROPERTIES.DEACTIVATE),
  validate({ params: propertyIdParamSchema }),
  propertyController.deactivate,
);
propertyRoutes.patch(
  "/:id/activate",
  requirePermission(PERMISSIONS.PROPERTIES.DEACTIVATE),
  validate({ params: propertyIdParamSchema }),
  propertyController.activate,
);
