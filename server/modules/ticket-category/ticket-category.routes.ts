import { Router } from "express";
import { ticketCategoryController } from "./ticket-category.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import {
  nameOnlyBodySchema,
  uuidIdParamSchema,
} from "../../middleware/commonSchemas.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const ticketCategoryRoutes = Router();
ticketCategoryRoutes.use(authenticate);

ticketCategoryRoutes.get("/", ticketCategoryController.findAll);
ticketCategoryRoutes.post(
  "/",
  requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE),
  validate({ body: nameOnlyBodySchema }),
  ticketCategoryController.create,
);
ticketCategoryRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE),
  validate({ params: uuidIdParamSchema, body: nameOnlyBodySchema }),
  ticketCategoryController.update,
);
ticketCategoryRoutes.patch(
  "/:id/deactivate",
  requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE),
  validate({ params: uuidIdParamSchema }),
  ticketCategoryController.deactivate,
);
ticketCategoryRoutes.patch(
  "/:id/activate",
  requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE),
  validate({ params: uuidIdParamSchema }),
  ticketCategoryController.activate,
);
