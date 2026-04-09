import type { Request, Response } from "express";
import { todoService } from "./todo.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const todoController = {
  async findAll(req: Request, res: Response) {
    try {
      const { period, status, page, limit } = req.query;
      const result = await todoService.findAll(req.user!.id, {
        period: period as string,
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      sendSuccess(res, result);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async getStats(req: Request, res: Response) {
    try {
      const stats = await todoService.getStats(req.user!.id);
      sendSuccess(res, stats);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async create(req: Request, res: Response) {
    try {
      const { title, dueDate } = req.body;
      if (!title || !dueDate) {
        return sendError(res, "Title and due date are required", 400);
      }
      const todo = await todoService.create(req.user!.id, title, dueDate);
      sendSuccess(res, todo, "Todo created", 201);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { title, dueDate } = req.body;
      const todo = await todoService.update(req.params.id, req.user!.id, { title, dueDate });
      sendSuccess(res, todo, "Todo updated");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async complete(req: Request, res: Response) {
    try {
      const todo = await todoService.complete(req.params.id, req.user!.id);
      sendSuccess(res, todo, "Todo completed");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async reopen(req: Request, res: Response) {
    try {
      const todo = await todoService.reopen(req.params.id, req.user!.id);
      sendSuccess(res, todo, "Todo reopened");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async remove(req: Request, res: Response) {
    try {
      await todoService.remove(req.params.id, req.user!.id);
      sendSuccess(res, null, "Todo deleted");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
