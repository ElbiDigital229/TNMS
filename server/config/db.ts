import { PrismaClient } from "@prisma/client";

const base = new PrismaClient();

/**
 * Hide legacy + soft-deleted tickets from list/count/aggregate queries by
 * default. Callers can opt out per-query by passing `__includeHidden: true`
 * inside `where`, or by explicitly setting `legacy` / `deletedAt` themselves.
 */
const HIDE_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

export const prisma = base.$extends({
  query: {
    ticket: {
      async $allOperations({ operation, args, query }) {
        if (HIDE_OPS.has(operation)) {
          const w: any = (args as any).where ?? {};
          if (w.__includeHidden) {
            delete w.__includeHidden;
          } else {
            if (w.legacy === undefined) w.legacy = false;
            if (w.deletedAt === undefined) w.deletedAt = null;
          }
          (args as any).where = w;
        }
        return query(args);
      },
    },
  },
});
