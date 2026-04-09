import type { Request, Response } from "express";
import { authService } from "./auth.service.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { AppError } from "../../utils/appError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    // req.body is validated by `validate(loginSchema)` on the route.
    const { username, password } = req.body as { username: string; password: string };
    try {
      const result = await authService.login(username, password);
      sendSuccess(res, result, "Login successful");
    } catch (err) {
      // Normalize all auth failures to a 401 with a generic message so we
      // don't leak whether a username exists, is deactivated, etc.
      throw AppError.unauthorized("Invalid credentials");
    }
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getMe(req.user!.id);
    sendSuccess(res, user);
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    sendSuccess(res, null, "Password updated successfully");
  }),

  signOutEverywhere: asyncHandler(async (req: Request, res: Response) => {
    await authService.bumpTokenVersion(req.user!.id);
    sendSuccess(res, null, "Signed out on all devices");
  }),
};
