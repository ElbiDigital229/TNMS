import { Router } from "express";
import { ticketScheduleController } from "./ticketSchedule.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const ticketScheduleRoutes = Router();
ticketScheduleRoutes.use(authenticate);

// Use TICKETS.CREATE permission for managing schedules
ticketScheduleRoutes.get("/", requirePermission(PERMISSIONS.TICKETS.CREATE), ticketScheduleController.findAll);
ticketScheduleRoutes.get("/:id", requirePermission(PERMISSIONS.TICKETS.CREATE), ticketScheduleController.findById);
ticketScheduleRoutes.post("/", requirePermission(PERMISSIONS.TICKETS.CREATE), ticketScheduleController.create);
ticketScheduleRoutes.patch("/:id", requirePermission(PERMISSIONS.TICKETS.CREATE), ticketScheduleController.update);
ticketScheduleRoutes.delete("/:id", requirePermission(PERMISSIONS.TICKETS.CREATE), ticketScheduleController.delete);
ticketScheduleRoutes.patch("/:id/toggle", requirePermission(PERMISSIONS.TICKETS.CREATE), ticketScheduleController.toggle);
