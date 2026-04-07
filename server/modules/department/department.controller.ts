import type { Request, Response } from "express";
import { departmentService } from "./department.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const departmentController = {
  async findAll(_req: Request, res: Response) {
    try {
      const departments = await departmentService.findAll();
      sendSuccess(res, departments);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { name, headUserId } = req.body;
      if (!name) return sendError(res, "Name is required", 400);
      const department = await departmentService.create(name, headUserId);
      sendSuccess(res, department, "Department created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { name, headUserId } = req.body;
      if (!name) return sendError(res, "Name is required", 400);
      const department = await departmentService.update(req.params.id, name, headUserId);
      sendSuccess(res, department, "Department updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async deactivate(req: Request, res: Response) {
    try {
      const department = await departmentService.deactivate(req.params.id);
      sendSuccess(res, department, "Department deactivated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async activate(req: Request, res: Response) {
    try {
      const department = await departmentService.activate(req.params.id);
      sendSuccess(res, department, "Department activated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async getUsers(req: Request, res: Response) {
    try {
      const users = await departmentService.getUsersByDepartment(req.params.id);
      sendSuccess(res, users);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
