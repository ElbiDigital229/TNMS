import { z } from "zod";

// Shared validation building blocks reused across the simple CRUD modules
// (designation, ticket-category, asset-category, area-group, etc.). Keeps
// the per-module schema files trivial.

export const uuidIdParamSchema = z.object({
  id: z.string().uuid("Invalid id"),
});

export const nameOnlyBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
});
