import { Router } from "express";
import { ticketController } from "./ticket.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireAnyPermission, requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import { uploadMultiple } from "../../middleware/upload.js";
import {
  createTicketSchema,
  updateTicketSchema,
  updateStatusSchema,
  addCommentSchema,
  assignSchema,
  blockTicketSchema,
  unblockTicketSchema,
  deleteImageSchema,
  bulkImportSchema,
  ticketIdParamSchema,
  ticketCommentParamSchema,
  listTicketsQuerySchema,
} from "./ticket.schemas.js";

export const ticketRoutes = Router();
ticketRoutes.use(authenticate);

ticketRoutes.get(
  "/",
  requireAnyPermission(PERMISSIONS.TICKETS.VIEW_ALL, PERMISSIONS.TICKETS.VIEW_ASSIGNED),
  validate({ query: listTicketsQuerySchema }),
  ticketController.findAll,
);
ticketRoutes.get(
  "/:id",
  validate({ params: ticketIdParamSchema }),
  ticketController.findById,
); // access checked inside controller (assignee, creator, blocker)
ticketRoutes.post(
  "/",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  uploadMultiple,
  validate({ body: createTicketSchema }),
  ticketController.create,
);
ticketRoutes.post(
  "/bulk-import",
  requirePermission(PERMISSIONS.TICKETS.CREATE),
  validate({ body: bulkImportSchema }),
  ticketController.bulkImport,
);
ticketRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.TICKETS.EDIT),
  uploadMultiple,
  validate({ params: ticketIdParamSchema, body: updateTicketSchema }),
  ticketController.update,
);
ticketRoutes.delete(
  "/:id/images",
  requirePermission(PERMISSIONS.TICKETS.EDIT),
  validate({ params: ticketIdParamSchema, body: deleteImageSchema }),
  ticketController.deleteImage,
);
ticketRoutes.patch(
  "/:id/status",
  requirePermission(PERMISSIONS.TICKETS.UPDATE_STATUS),
  validate({ params: ticketIdParamSchema, body: updateStatusSchema }),
  ticketController.updateStatus,
);
ticketRoutes.post(
  "/:id/comments",
  requirePermission(PERMISSIONS.TICKETS.COMMENT),
  validate({ params: ticketIdParamSchema, body: addCommentSchema }),
  ticketController.addComment,
);
ticketRoutes.put(
  "/:id/comments/:commentId",
  requirePermission(PERMISSIONS.TICKETS.COMMENT),
  validate({ params: ticketCommentParamSchema, body: addCommentSchema }),
  ticketController.editComment,
);
ticketRoutes.delete(
  "/:id/comments/:commentId",
  requirePermission(PERMISSIONS.TICKETS.COMMENT),
  validate({ params: ticketCommentParamSchema }),
  ticketController.deleteComment,
);
ticketRoutes.patch(
  "/:id/assign",
  requirePermission(PERMISSIONS.TICKETS.ASSIGN),
  validate({ params: ticketIdParamSchema, body: assignSchema }),
  ticketController.assign,
);
ticketRoutes.post(
  "/bulk-assign",
  requirePermission(PERMISSIONS.TICKETS.ASSIGN),
  ticketController.bulkAssign,
);
ticketRoutes.get(
  "/:id/assignable-users",
  requirePermission(PERMISSIONS.TICKETS.ASSIGN),
  validate({ params: ticketIdParamSchema }),
  ticketController.getAssignableUsers,
);
ticketRoutes.get(
  "/:id/related",
  validate({ params: ticketIdParamSchema }),
  ticketController.findRelated,
);
ticketRoutes.post(
  "/:id/block",
  requireAnyPermission(PERMISSIONS.TICKETS.UPDATE_STATUS, PERMISSIONS.TICKETS.VIEW_ASSIGNED),
  validate({ params: ticketIdParamSchema, body: blockTicketSchema }),
  ticketController.blockTicket,
);
ticketRoutes.post(
  "/:id/unblock",
  requireAnyPermission(PERMISSIONS.TICKETS.UPDATE_STATUS, PERMISSIONS.TICKETS.VIEW_ASSIGNED),
  validate({ params: ticketIdParamSchema, body: unblockTicketSchema }),
  ticketController.unblockTicket,
);
ticketRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.TICKETS.DELETE),
  validate({ params: ticketIdParamSchema }),
  ticketController.softDelete,
);
ticketRoutes.post(
  "/:id/restore",
  requirePermission(PERMISSIONS.TICKETS.DELETE),
  validate({ params: ticketIdParamSchema }),
  ticketController.restore,
);
