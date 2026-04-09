import type { Request, Response } from "express";
import { todoService } from "./todo.service.js";
import { todoWatcherService } from "./todoWatcher.service.js";
import { sendSuccess, sendError } from "../../utils/apiResponse.js";

export const todoController = {
  async findAll(req: Request, res: Response) {
    try {
      const { period, status, page, limit, userId } = req.query;

      // If userId is provided, verify the requester is a watcher
      let targetUserId = req.user!.id;
      if (userId && userId !== req.user!.id) {
        const allowed = await todoWatcherService.isWatcher(userId as string, req.user!.id);
        if (!allowed) {
          return sendError(res, "You do not have access to this user's todo list", 403);
        }
        targetUserId = userId as string;
      }

      const result = await todoService.findAll(targetUserId, {
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
      const userId = (req.query.userId as string) || req.user!.id;

      // If viewing someone else's stats, check watcher access
      if (userId !== req.user!.id) {
        const allowed = await todoWatcherService.isWatcher(userId, req.user!.id);
        if (!allowed) {
          return sendError(res, "You do not have access to this user's stats", 403);
        }
      }

      const stats = await todoService.getStats(userId);
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

  // Watcher endpoints
  async addWatcher(req: Request, res: Response) {
    try {
      const { watcherId } = req.body;
      const watcher = await todoWatcherService.addWatcher(req.user!.id, watcherId);
      sendSuccess(res, watcher, "Watcher added", 201);
    } catch (error: any) {
      if (error.code === "P2002") {
        return sendError(res, "This user is already a watcher", 409);
      }
      sendError(res, error.message);
    }
  },

  async removeWatcher(req: Request, res: Response) {
    try {
      await todoWatcherService.removeWatcher(req.user!.id, req.params.id);
      sendSuccess(res, null, "Watcher removed");
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async getMyWatchers(req: Request, res: Response) {
    try {
      const watchers = await todoWatcherService.getMyWatchers(req.user!.id);
      sendSuccess(res, watchers);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },

  async getWatchedLists(req: Request, res: Response) {
    try {
      const watched = await todoWatcherService.getWatchedLists(req.user!.id);
      sendSuccess(res, watched);
    } catch (error: any) {
      sendError(res, error.message);
    }
  },
};
