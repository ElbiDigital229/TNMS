import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import type { ZodError } from "zod";

type AcquisitionTable = "AcquisitionAgent" | "AcquisitionLand" | "AcquisitionBuilding";
type AcquisitionCodeColumn = "agentCode" | "landCode" | "buildingCode";

/**
 * Compute the next sequential code "{prefix}-NNNNN" by reading MAX from
 * the column as an integer. Done via raw SQL so 5-digit codes don't get
 * lex-sorted incorrectly against any legacy 4-digit codes.
 */
export async function nextCode(
  prefix: string,
  table: AcquisitionTable,
  column: AcquisitionCodeColumn,
): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<{ max: number | null }[]>(
    `SELECT MAX(CAST(SPLIT_PART("${column}", '-', 2) AS INTEGER)) AS max
     FROM "${table}"
     WHERE "${column}" ~ '^${prefix}-[0-9]+$'`,
  );
  const next = (rows[0]?.max ?? 0) + 1;
  return `${prefix}-${String(next).padStart(5, "0")}`;
}

/**
 * Run an insert that needs an auto-generated unique code. If we lose a
 * race against another concurrent insert (Prisma P2002 unique constraint),
 * regenerate the code and retry. The brief jitter on retry reduces
 * thundering-herd contention from large bulk imports.
 */
export async function withCodeRetry<T>(
  prefix: string,
  table: AcquisitionTable,
  column: AcquisitionCodeColumn,
  attemptCreate: (code: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    const code = await nextCode(prefix, table, column);
    try {
      return await attemptCreate(code);
    } catch (e) {
      lastErr = e;
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        await new Promise((r) => setTimeout(r, Math.random() * 25 + 5));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Render a ZodError as a single readable sentence. */
export function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "?"}: ${i.message}`)
    .join("; ");
}

/**
 * Sanitize an arbitrary thrown error into something fit to show an admin
 * in a CSV-import results table. Strips Prisma stack noise.
 */
export function formatImportError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const target = (e.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      return `Duplicate value for ${target}`;
    }
    if (e.code === "P2003") return "Referenced record does not exist";
    if (e.code === "P2025") return "Record not found";
    return (e.message.split("\n")[0] || "Database error").trim();
  }
  if (e instanceof Prisma.PrismaClientValidationError) {
    const missing = e.message.match(/Argument `(\w+)` is missing/);
    if (missing) return `${missing[1]} is required`;
    const badEnum = e.message.match(/Invalid value for argument `(\w+)`\. Expected (\w+)/);
    if (badEnum) return `${badEnum[1]} must be a valid ${badEnum[2]}`;
    return "Invalid field value";
  }
  if (e instanceof Error) return e.message.split("\n")[0];
  return "Unknown error";
}
