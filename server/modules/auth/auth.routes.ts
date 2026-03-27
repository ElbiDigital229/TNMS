import { Router } from "express";
import { authController } from "./auth.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export const authRoutes = Router();

authRoutes.post("/login", authController.login);
authRoutes.get("/me", authenticate, authController.me);
