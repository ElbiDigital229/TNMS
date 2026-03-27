import { Router } from "express";
import { ticketController } from "./ticket.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireAnyPermission, requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import { uploadSingle } from "../../middleware/upload.js";

export const ticketRoutes = Router();
ticketRoutes.use(authenticate);

ticketRoutes.get("/", requireAnyPermission(PERMISSIONS.TICKETS.VIEW_ALL, PERMISSIONS.TICKETS.VIEW_ASSIGNED), ticketController.findAll);
ticketRoutes.get("/:id", requireAnyPermission(PERMISSIONS.TICKETS.VIEW_ALL, PERMISSIONS.TICKETS.VIEW_ASSIGNED), ticketController.findById);
ticketRoutes.post("/", requirePermission(PERMISSIONS.TICKETS.CREATE), uploadSingle, ticketController.create);
ticketRoutes.put("/:id", requirePermission(PERMISSIONS.TICKETS.EDIT), uploadSingle, ticketController.update);
ticketRoutes.patch("/:id/status", requirePermission(PERMISSIONS.TICKETS.UPDATE_STATUS), ticketController.updateStatus);
ticketRoutes.post("/:id/comments", requirePermission(PERMISSIONS.TICKETS.COMMENT), ticketController.addComment);
ticketRoutes.patch("/:id/assign", requirePermission(PERMISSIONS.TICKETS.ASSIGN), ticketController.assign);
ticketRoutes.get("/:id/assignable-users", requirePermission(PERMISSIONS.TICKETS.ASSIGN), ticketController.getAssignableUsers);
