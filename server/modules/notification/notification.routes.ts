import { Router } from "express";
import { z } from "zod";
import { notificationController } from "./notification.controller.js";
import { deviceTokenController } from "./deviceToken.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { uuidIdParamSchema } from "../../middleware/commonSchemas.js";

const deviceTokenRegisterSchema = z.object({
  token: z.string().trim().min(1, "Device token is required").max(4096),
  platform: z.enum(["android", "ios", "web"]).optional(),
});

const deviceTokenUnregisterSchema = z.object({
  token: z.string().trim().min(1, "Device token is required").max(4096),
});

const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  isRead: z.enum(["true", "false"]).optional(),
  type: z.string().optional(),
});

const router = Router();

router.use(authenticate);

router.get("/", validate({ query: listNotificationsQuerySchema }), notificationController.findAll);
router.get("/unread-count", notificationController.getUnreadCount);
router.post("/run-scheduled-checks", notificationController.runScheduledChecks);
router.post(
  "/device-token",
  validate({ body: deviceTokenRegisterSchema }),
  deviceTokenController.register,
);
router.delete(
  "/device-token",
  validate({ body: deviceTokenUnregisterSchema }),
  deviceTokenController.unregister,
);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch(
  "/:id/read",
  validate({ params: uuidIdParamSchema }),
  notificationController.markAsRead,
);

export { router as notificationRoutes };
