import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { sendError } from "../utils/apiResponse.js";
import { prisma } from "../config/db.js";
import { ALL_PERMISSION_KEYS } from "../../shared/permissions.js";

export interface AuthPayload {
  id: string;
  username: string;
  isSuperAdmin: boolean;
  roleId: string;
  roleName: string;
  permissions: string[];
  allProperties: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Authentication required", 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      username: string;
      tv?: number;
    };

    // Hydrate user data from database
    prisma.user
      .findUnique({
        where: { id: decoded.id },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      })
      .then((user) => {
        if (!user || user.status === "INACTIVE" || user.status === "BLOCKED") {
          return sendError(res, "Account not found or deactivated", 401);
        }

        // Session invalidation: reject any token whose tv claim does not
        // match the user's current tokenVersion. Tokens predating this
        // feature have no tv claim — treat them as 0, matching a fresh
        // user, so existing sessions survive the rollout.
        const tokenTv = decoded.tv ?? 0;
        if (tokenTv !== user.tokenVersion) {
          return sendError(res, "Session expired, please sign in again", 401);
        }

        const permissions = user.isSuperAdmin
          ? ALL_PERMISSION_KEYS
          : user.role.permissions.map((rp) => rp.permission.key);

        req.user = {
          id: user.id,
          username: user.username,
          isSuperAdmin: user.isSuperAdmin,
          roleId: user.role.id,
          roleName: user.role.name,
          permissions,
          allProperties: user.allProperties,
        };

        next();
      })
      .catch(() => {
        return sendError(res, "Internal server error during authentication", 500);
      });
  } catch {
    return sendError(res, "Invalid or expired token", 401);
  }
}
