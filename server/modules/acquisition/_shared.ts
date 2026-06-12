import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import type { ZodError } from "zod";

type AcquisitionTable = "AcquisitionAgent" | "AcquisitionLand" | "AcquisitionBuilding";
type AcquisitionCodeColumn = "agentCode" | "landCode" | "buildingCode";

const SEQUENCE_BY_TABLE: Record<AcquisitionTable, string> = {
  AcquisitionAgent: "acquisition_agent_code_seq",
  AcquisitionLand: "acquisition_land_code_seq",
  AcquisitionBuilding: "acquisition_building_code_seq",
};

/**
 * Compute the next sequential code "{prefix}-NNNNN".
 *
 * Backed by a Postgres SEQUENCE per entity. Sequences are atomic — concurrent
 * callers each get a distinct value, so we cannot collide on the unique code
 * column. The sequences are seeded past any pre-existing MAX+1 codes by the
 * migration that introduced them.
 */
export async function nextCode(
  prefix: string,
  table: AcquisitionTable,
  _column: AcquisitionCodeColumn,
): Promise<string> {
  const seq = SEQUENCE_BY_TABLE[table];
  const rows = await prisma.$queryRawUnsafe<{ nextval: bigint | number }[]>(
    `SELECT nextval('${seq}') AS nextval`,
  );
  const n = Number(rows[0].nextval);
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

/**
 * Run an insert with auto-generated code. Sequences should make conflicts
 * impossible, but the retry shell stays in place as defense-in-depth against
 * manual code insertion or post-migration data import that bypasses the
 * sequence.
 */
export async function withCodeRetry<T>(
  prefix: string,
  table: AcquisitionTable,
  column: AcquisitionCodeColumn,
  attemptCreate: (code: string) => Promise<T>,
  maxAttempts = 3,
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
 * Pre-process one CSV-source row before schema validation.
 *
 * CSVs deliver everything as strings — including empty cells. The create
 * schemas expect typed input (numbers, enums), so without this step
 * every "4" fails as "Expected number, received string" and every blank
 * optional enum field fails as "Invalid enum value ... received ''".
 *
 * We:
 *  - Drop empty-string, null, and undefined values entirely, so an
 *    optional field that lacks an explicit empty-string fallback still
 *    passes validation.
 *  - Coerce strings in the listed `numericFields` (decimals) and
 *    `integerFields` (ints) into actual numbers so strict numeric
 *    schemas accept them.
 */
export function preprocessCsvRow(
  row: Record<string, unknown>,
  opts: { numericFields?: string[]; integerFields?: string[] } = {},
): Record<string, unknown> {
  const intSet = new Set(opts.integerFields ?? []);
  const numSet = new Set(opts.numericFields ?? []);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === "" || v === undefined || v === null) continue;
    if (typeof v === "string" && intSet.has(k)) {
      const n = parseInt(v, 10);
      out[k] = Number.isNaN(n) ? v : n;
      continue;
    }
    if (typeof v === "string" && numSet.has(k)) {
      const n = parseFloat(v.replace(/,/g, ""));
      out[k] = Number.isNaN(n) ? v : n;
      continue;
    }
    out[k] = v;
  }
  return out;
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

/**
 * Encode one cell for CSV output with formula-injection mitigation.
 *
 * Excel and other spreadsheet apps treat cells starting with =, +, -, @,
 * tab, or CR as formulas. An attacker who stores `=HYPERLINK("evil")` in
 * a free-text field can ship that payload to anyone who opens the
 * exported CSV in Excel. We neutralise by prefixing such values with a
 * single quote — Excel renders the value as-is and skips formula parsing.
 *
 * Reference: OWASP CSV Injection.
 */
function csvCell(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return csvCell(v.join("|"));
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // Defang formula-leading characters.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Convert an array of rows into a CSV string, BOM-prefixed for Excel's
 * UTF-8 detection. `columns[].key` may be dotted ("agent.agentCode")
 * to walk nested objects safely.
 */
export function rowsToCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
): string {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const path = c.key.split(".");
          let v: unknown = r;
          for (const p of path) v = (v as Record<string, unknown> | null)?.[p];
          return csvCell(v);
        })
        .join(","),
    )
    .join("\n");
  return "﻿" + header + "\n" + body;
}
