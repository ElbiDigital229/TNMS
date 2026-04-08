/**
 * Typed application error. Controllers/services throw these instead of
 * calling sendError directly; the central error handler maps them to
 * clean HTTP responses without leaking internals.
 */
export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status = 500, code = "INTERNAL_ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, "BAD_REQUEST", details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError(message, 401, "UNAUTHORIZED");
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new AppError(message, 403, "FORBIDDEN");
  }
  static notFound(message = "Resource not found") {
    return new AppError(message, 404, "NOT_FOUND");
  }
  static conflict(message: string) {
    return new AppError(message, 409, "CONFLICT");
  }
  static validation(message: string, details?: unknown) {
    return new AppError(message, 422, "VALIDATION_ERROR", details);
  }
}
