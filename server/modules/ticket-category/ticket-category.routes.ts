import { Router } from "express";
import { ticketCategoryController } from "./ticket-category.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const ticketCategoryRoutes = Router();
ticketCategoryRoutes.use(authenticate);

ticketCategoryRoutes.get("/", ticketCategoryController.findAll);
ticketCategoryRoutes.post("/", requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE), ticketCategoryController.create);
ticketCategoryRoutes.put("/:id", requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE), ticketCategoryController.update);
ticketCategoryRoutes.patch("/:id/deactivate", requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE), ticketCategoryController.deactivate);
ticketCategoryRoutes.patch("/:id/activate", requirePermission(PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE), ticketCategoryController.activate);
