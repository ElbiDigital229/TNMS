import { Router } from "express";
import { authController } from "./auth.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "./auth.schemas.js";

export const authRoutes = Router();

authRoutes.post("/login", validate({ body: loginSchema }), authController.login);
authRoutes.get("/me", authenticate, authController.me);

// Password-reset flow (unauthenticated — tokenized).
authRoutes.post(
  "/forgot-password",
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
authRoutes.post(
  "/reset-password",
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

// Authenticated self-service password change.
authRoutes.post(
  "/change-password",
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

// "Sign me out of all my devices".
authRoutes.post("/sign-out-everywhere", authenticate, authController.signOutEverywhere);
