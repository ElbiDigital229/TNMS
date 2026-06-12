import { Router } from "express";
import { agentController } from "./agent.controller.js";
import { authenticate } from "../../../middleware/authenticate.js";
import { requirePermission } from "../../../middleware/authorize.js";
import { validate } from "../../../middleware/validate.js";
import { PERMISSIONS } from "../../../../shared/permissions.js";
import {
  createAgentSchema,
  updateAgentSchema,
  agentIdParamSchema,
  listAgentsQuerySchema,
  bulkImportAgentsSchema,
} from "./agent.schemas.js";

export const acquisitionAgentRoutes = Router();
acquisitionAgentRoutes.use(authenticate);

acquisitionAgentRoutes.get(
  "/",
  requirePermission(PERMISSIONS.ACQUISITIONS.VIEW),
  validate({ query: listAgentsQuerySchema }),
  agentController.findAll,
);

acquisitionAgentRoutes.get(
  "/export.csv",
  requirePermission(PERMISSIONS.ACQUISITIONS.EXPORT),
  validate({ query: listAgentsQuerySchema }),
  agentController.exportCsv,
);

acquisitionAgentRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.VIEW),
  validate({ params: agentIdParamSchema }),
  agentController.findById,
);

acquisitionAgentRoutes.get(
  "/:id/deals",
  requirePermission(PERMISSIONS.ACQUISITIONS.VIEW),
  validate({ params: agentIdParamSchema }),
  agentController.findDeals,
);

acquisitionAgentRoutes.post(
  "/",
  requirePermission(PERMISSIONS.ACQUISITIONS.CREATE),
  validate({ body: createAgentSchema }),
  agentController.create,
);

acquisitionAgentRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.EDIT),
  validate({ params: agentIdParamSchema, body: updateAgentSchema }),
  agentController.update,
);

acquisitionAgentRoutes.delete(
  "/:id",
  requirePermission(PERMISSIONS.ACQUISITIONS.DELETE),
  validate({ params: agentIdParamSchema }),
  agentController.softDelete,
);

acquisitionAgentRoutes.patch(
  "/:id/restore",
  requirePermission(PERMISSIONS.ACQUISITIONS.DELETE),
  validate({ params: agentIdParamSchema }),
  agentController.restore,
);

acquisitionAgentRoutes.post(
  "/import",
  requirePermission(PERMISSIONS.ACQUISITIONS.IMPORT),
  validate({ body: bulkImportAgentsSchema }),
  agentController.bulkImport,
);
