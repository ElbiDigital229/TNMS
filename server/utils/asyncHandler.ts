import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Wraps an async express handler so thrown errors propagate to the central
 * error middleware instead of becoming unhandled promise rejections.
 *
 * Usage:
 *   router.get("/tickets", asyncHandler(async (req, res) => { ... }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
