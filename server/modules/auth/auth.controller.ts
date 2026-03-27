import type { Request, Response } from "express";
import { authService } from "./auth.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return sendError(res, "Username and password are required", 400);
      }

      const result = await authService.login(username, password);
      sendSuccess(res, result, "Login successful");
    } catch (error: any) {
      sendError(res, error.message || "Login failed", 401);
    }
  },

  async me(req: Request, res: Response) {
    try {
      const user = await authService.getMe(req.user!.id);
      sendSuccess(res, user);
    } catch (error: any) {
      sendError(res, error.message || "User not found", 404);
    }
  },
};
