import type { Request, Response } from "express";
import { userService } from "./user.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const userController = {
  async findAll(req: Request, res: Response) {
    try {
      const { page, limit, search, roleId, status } = req.query;

      const result = await userService.findAll({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        roleId: roleId as string,
        status: status as any,
      });

      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message || "Failed to fetch users");
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const user = await userService.findById(req.params.id);

      if (!user) {
        return sendError(res, "User not found", 404);
      }

      sendSuccess(res, user);
    } catch (error: any) {
      sendError(res, error.message || "Failed to fetch user");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { username, password, fullName, email, phone, roleId, reportsToId, departmentId, allProperties, propertyIds } = req.body;

      if (!username || !password || !roleId || !departmentId) {
        return sendError(res, "Username, password, roleId, and departmentId are required", 400);
      }

      const user = await userService.create({
        username,
        password,
        fullName,
        email,
        phone,
        roleId,
        reportsToId,
        departmentId,
        allProperties,
        propertyIds,
      });

      sendSuccess(res, user, "User created", 201);
    } catch (error: any) {
      sendError(res, error.message || "Failed to create user");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { fullName, email, phone, roleId, reportsToId, departmentId, allProperties, propertyIds } = req.body;

      const user = await userService.update(req.params.id, {
        fullName,
        email,
        phone,
        roleId,
        reportsToId,
        departmentId: departmentId || null,
        allProperties,
        propertyIds,
      });

      sendSuccess(res, user, "User updated");
    } catch (error: any) {
      sendError(res, error.message || "Failed to update user");
    }
  },

  async updateProperties(req: Request, res: Response) {
    try {
      const { propertyIds } = req.body;

      if (!Array.isArray(propertyIds)) {
        return sendError(res, "propertyIds must be an array", 400);
      }

      const user = await userService.updateProperties(req.params.id, propertyIds);
      sendSuccess(res, user, "User properties updated");
    } catch (error: any) {
      sendError(res, error.message || "Failed to update user properties");
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { newPassword } = req.body;

      if (!newPassword) {
        return sendError(res, "newPassword is required", 400);
      }

      const user = await userService.resetPassword(req.params.id, newPassword, req.user!.id);
      sendSuccess(res, user, "Password reset successfully");
    } catch (error: any) {
      sendError(res, error.message || "Failed to reset password");
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const user = await userService.deactivate(req.params.id, req.user!.id);
      sendSuccess(res, user, "User deactivated");
    } catch (error: any) {
      sendError(res, error.message || "Failed to deactivate user");
    }
  },

  async block(req: Request, res: Response) {
    try {
      const user = await userService.block(req.params.id, req.user!.id);
      sendSuccess(res, user, "User access blocked");
    } catch (error: any) {
      sendError(res, error.message || "Failed to block user");
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const user = await userService.activate(req.params.id, req.user!.id);
      sendSuccess(res, user, "User activated");
    } catch (error: any) {
      sendError(res, error.message || "Failed to activate user");
    }
  },

  async getSubordinates(req: Request, res: Response) {
    try {
      const subordinates = await userService.getSubordinates(req.params.id);
      sendSuccess(res, subordinates);
    } catch (error: any) {
      sendError(res, error.message || "Failed to fetch subordinates");
    }
  },

  async bulkImport(req: Request, res: Response) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return sendError(res, "items array is required", 400);
      }
      if (items.length > 500) {
        return sendError(res, "Maximum 500 items per import", 400);
      }

      const results = await userService.bulkCreate(items);
      const successCount = results.filter((r) => r.status === "success").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      sendSuccess(res, { results, summary: { total: items.length, success: successCount, errors: errorCount } },
        `Imported ${successCount} users, ${errorCount} errors`, 201);
    } catch (error: any) {
      sendError(res, error.message || "Failed to bulk import users");
    }
  },

  async getManagerProperties(req: Request, res: Response) {
    try {
      const result = await userService.getManagerPropertyIds(req.params.id);
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message || "Failed to fetch manager properties");
    }
  },
};
