import type { Request, Response } from "express";
import { roleService } from "./role.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const roleController = {
  async findAll(req: Request, res: Response) {
    try {
      const activeOnly = req.query.activeOnly === "true";
      const roles = await roleService.findAll(activeOnly);
      sendSuccess(res, roles);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const role = await roleService.findById(req.params.id);
      if (!role) {
        return sendError(res, "Role not found", 404);
      }
      sendSuccess(res, role);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, permissionIds } = req.body;
      if (!name || !permissionIds) {
        return sendError(res, "Name and permissionIds are required", 400);
      }

      const role = await roleService.create({ name, permissionIds });

      sendSuccess(res, role, "Role created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name, permissionIds, expectedUpdatedAt } = req.body;
      const role = await roleService.update(req.params.id, {
        name,
        permissionIds,
        expectedUpdatedAt,
      });
      sendSuccess(res, role, "Role updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const role = await roleService.deactivate(req.params.id);
      sendSuccess(res, role, "Role deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const role = await roleService.activate(req.params.id);
      sendSuccess(res, role, "Role activated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
