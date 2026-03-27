import { Router } from "express";
import { todoController } from "./todo.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/authorize.js";
import { PERMISSIONS } from "../../../shared/permissions.js";

const router = Router();

router.use(authenticate);
router.use(requirePermission(PERMISSIONS.TODOS.ACCESS));

router.get("/", todoController.findAll);
router.get("/stats", todoController.getStats);
router.post("/", todoController.create);
router.patch("/:id/complete", todoController.complete);
router.patch("/:id/reopen", todoController.reopen);
router.delete("/:id", todoController.remove);

export const todoRoutes = router;
