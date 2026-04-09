import { Router } from "express";
import { ticketScheduleController } from "./ticketSchedule.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { uuidIdParamSchema } from "../../middleware/commonSchemas.js";
import {
  createTicketScheduleSchema,
  updateTicketScheduleSchema,
  listTicketSchedulesQuerySchema,
} from "./ticketSchedule.schemas.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

export const ticketScheduleRoutes = Router();
ticketScheduleRoutes.use(authenticate);

// Use TICKETS.CREATE permission for managing schedules
ticketScheduleRoutes.get(
  "/",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  validate({ query: listTicketSchedulesQuerySchema }),
  ticketScheduleController.findAll,
);
ticketScheduleRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  validate({ params: uuidIdParamSchema }),
  ticketScheduleController.findById,
);
ticketScheduleRoutes.post(
  "/",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  validate({ body: createTicketScheduleSchema }),
  ticketScheduleController.create,
);
ticketScheduleRoutes.patch(
  "/:id",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  validate({ params: uuidIdParamSchema, body: updateTicketScheduleSchema }),
  ticketScheduleController.update,
);
ticketScheduleRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  validate({ params: uuidIdParamSchema }),
  ticketScheduleController.delete,
);
ticketScheduleRoutes.patch(
  "/:id/toggle",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  validate({ params: uuidIdParamSchema }),
  ticketScheduleController.toggle,
);
