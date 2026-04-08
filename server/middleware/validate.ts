import type { Request, Response, NextFunction } from "express";
import type { ZodTypeAny } from "zod";

/**
 * Tiny schema-validation middleware. Parses the specified part of the
 * request against a Zod schema and replaces it with the parsed (type-safe)
 * value — failures throw ZodError which the central error handler maps
 * to a 422 with field-level details.
 *
 *   router.post("/tickets", validate({ body: createTicketSchema }), handler);
 */
export function validate(schemas: {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        // req.query is read-only on Express 5; cast for Express 4.
        (req as unknown as { query: unknown }).query = parsed;
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        (req as unknown as { params: unknown }).params = parsed;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
