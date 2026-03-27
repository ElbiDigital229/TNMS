import type { Response } from "express";

export function sendSuccess(
  res: Response,
  data: unknown = null,
  message = "Success",
  statusCode = 200
) {
  res.status(statusCode).json({ success: true, data, message });
}

export function sendError(
  res: Response,
  message = "Internal Server Error",
  statusCode = 500
) {
  res.status(statusCode).json({ success: false, error: message });
}
