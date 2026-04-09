import { Router } from "express";
import { userController } from "./user.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../../../shared/permissions.js";
import {
  createUserSchema,
  updateUserSchema,
  updateUserPropertiesSchema,
  resetPasswordSchema,
  bulkImportUsersSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from "./user.schemas.js";

export const userRoutes = Router();

userRoutes.use(authenticate);

userRoutes.get(
  "/",
  requirePermission(PERMISSIONS.USERS.VIEW),
  validate({ query: listUsersQuerySchema }),
  userController.findAll,
);
userRoutes.post(
  "/",
  requirePermission(PERMISSIONS.USERS.CREATE),
  validate({ body: createUserSchema }),
  userController.create,
);
userRoutes.post(
  "/bulk-import",
  requirePermission(PERMISSIONS.USERS.IMPORT),
  validate({ body: bulkImportUsersSchema }),
  userController.bulkImport,
);
userRoutes.get(
  "/:id",
  requirePermission(PERMISSIONS.USERS.VIEW),
  validate({ params: userIdParamSchema }),
  userController.findById,
);
userRoutes.put(
  "/:id/properties",
  requirePermission(PERMISSIONS.USERS.EDIT),
  validate({ params: userIdParamSchema, body: updateUserPropertiesSchema }),
  userController.updateProperties,
);
userRoutes.put(
  "/:id",
  requirePermission(PERMISSIONS.USERS.EDIT),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  userController.update,
);
userRoutes.patch(
  "/:id/password",
  requirePermission(PERMISSIONS.USERS.EDIT),
  validate({ params: userIdParamSchema, body: resetPasswordSchema }),
  userController.resetPassword,
);
userRoutes.patch(
  "/:id/deactivate",
  requirePermission(PERMISSIONS.USERS.DEACTIVATE),
  validate({ params: userIdParamSchema }),
  userController.deactivate,
);
userRoutes.patch(
  "/:id/block",
  requirePermission(PERMISSIONS.USERS.DEACTIVATE),
  validate({ params: userIdParamSchema }),
  userController.block,
);
userRoutes.patch(
  "/:id/activate",
  requirePermission(PERMISSIONS.USERS.DEACTIVATE),
  validate({ params: userIdParamSchema }),
  userController.activate,
);
