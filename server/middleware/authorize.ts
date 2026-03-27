import type { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/apiResponse.js";
import { rbacService } from "../services/rbac.service.js";

export function requirePermission(...keys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasAll = keys.every((key) => req.user!.permissions.includes(key));
    if (!hasAll) {
      return sendError(res, "You do not have permission to perform this action", 403);
    }

    next();
  };
}

export function requireAnyPermission(...keys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    if (req.user.isSuperAdmin) {
      return next();
    }

    const hasAny = keys.some((key) => req.user!.permissions.includes(key));
    if (!hasAny) {
      return sendError(res, "You do not have permission to perform this action", 403);
    }

    next();
  };
}

export function requirePropertyAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    if (req.user.isSuperAdmin || req.user.allProperties) {
      return next();
    }

    const propertyId =
      req.params.propertyId || req.params.id || req.body?.propertyId;

    if (!propertyId) {
      return next();
    }

    const propertyIds = await rbacService.getUserPropertyIds(req.user.id);

    if (propertyIds === "all") {
      return next();
    }

    if (!propertyIds.includes(propertyId)) {
      return sendError(res, "You do not have access to this property", 403);
    }

    next();
  };
}
