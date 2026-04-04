import { Router } from "express";
import { notificationController } from "./notification.controller.js";
import { deviceTokenController } from "./deviceToken.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.use(authenticate);

router.get("/", notificationController.findAll);
router.get("/unread-count", notificationController.getUnreadCount);
router.post("/run-scheduled-checks", notificationController.runScheduledChecks);
router.post("/device-token", deviceTokenController.register);
router.delete("/device-token", deviceTokenController.unregister);
router.patch("/read-all", notificationController.markAllAsRead);
router.patch("/:id/read", notificationController.markAsRead);

export { router as notificationRoutes };
