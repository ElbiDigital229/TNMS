import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/appError.js";
import { env } from "../config/env.js";

/**
 * Central error handler. Accepts anything thrown from controllers or
 * middleware and maps it to a safe, consistent JSON response. Logs the
 * full error server-side; clients only ever see a short, stable shape:
 *
 *   { success: false, error: string, code: string, details?: unknown }
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  // --- Typed app error -------------------------------------------------
  if (err instanceof AppError) {
    if (err.status >= 500) {
      console.error(`[${req.method} ${req.path}] AppError:`, err);
    }
    return res.status(err.status).json({
      success: false,
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // --- Zod validation error --------------------------------------------
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    });
  }

  // --- Prisma known errors ---------------------------------------------
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      return res.status(409).json({
        success: false,
        error: `A record with this ${target} already exists`,
        code: "CONFLICT",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Resource not found",
        code: "NOT_FOUND",
      });
    }
    if (err.code === "P2003") {
      return res.status(400).json({
        success: false,
        error: "Referenced resource does not exist",
        code: "BAD_REFERENCE",
      });
    }
    console.error(`[${req.method} ${req.path}] Prisma error:`, err);
    return res.status(500).json({
      success: false,
      error: "Database error",
      code: "DB_ERROR",
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(`[${req.method} ${req.path}] Prisma validation:`, err);
    return res.status(400).json({
      success: false,
      error: "Invalid request data",
      code: "BAD_REQUEST",
    });
  }

  // --- Anything else ---------------------------------------------------
  const anyErr = err as { message?: string; name?: string; stack?: string };
  console.error(`[${req.method} ${req.path}] Unhandled error:`, err);

  const isDev = !env.IS_PROD;
  res.status(500).json({
    success: false,
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    ...(isDev && anyErr?.message ? { devMessage: anyErr.message } : {}),
  });
}
