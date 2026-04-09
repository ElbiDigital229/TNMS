import { Router } from "express";
import { authController } from "./auth.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { loginSchema, changePasswordSchema } from "./auth.schemas.js";

export const authRoutes = Router();

authRoutes.post("/login", validate({ body: loginSchema }), authController.login);
authRoutes.get("/me", authenticate, authController.me);

// Authenticated self-service password change.
// Forgotten-password recovery is admin-assisted only: a user who can't log
// in contacts an admin, who uses POST /api/users/:id/reset-password to
// issue a new password and force a change on next login.
authRoutes.post(
  "/change-password",
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

// "Sign me out of all my devices".
authRoutes.post("/sign-out-everywhere", authenticate, authController.signOutEverywhere);
