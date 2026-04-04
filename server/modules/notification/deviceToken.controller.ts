import type { Request, Response } from "express";
import { fcmService } from "../../services/fcm.service.js";

export const deviceTokenController = {
  async register(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { token, platform } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Device token is required" });
      }

      await fcmService.registerToken(userId, token, platform || "android");
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to register device token:", error);
      res.status(500).json({ error: "Failed to register device token" });
    }
  },

  async unregister(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Device token is required" });
      }

      await fcmService.removeToken(token);
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to unregister device token:", error);
      res.status(500).json({ error: "Failed to unregister device token" });
    }
  },
};
