/**
 * One-shot backfill: mark every ticket created BEFORE the cutoff as `legacy`.
 * Idempotent — safe to re-run; will only flag rows that aren't already legacy
 * AND were created before the cutoff. Tickets created after the cutoff are
 * untouched, so the production API can keep creating fresh non-legacy tickets
 * concurrently with the migration.
 *
 * Usage:  npx tsx scripts/backfill-legacy-tickets.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Anything created before this instant is considered legacy.
const CUTOFF = new Date("2026-04-08T23:59:59Z");

async function main() {
  const total = await prisma.ticket.count();
  const beforeCutoff = await prisma.ticket.count({
    where: { createdAt: { lte: CUTOFF } },
  });
  const alreadyLegacy = await prisma.ticket.count({
    where: { legacy: true },
  });

  console.log(`Total tickets:           ${total}`);
  console.log(`Created on/before cutoff: ${beforeCutoff}`);
  console.log(`Already flagged legacy:  ${alreadyLegacy}`);

  const result = await prisma.ticket.updateMany({
    where: {
      legacy: false,
      createdAt: { lte: CUTOFF },
    },
    data: { legacy: true },
  });

  console.log(`\n✓ Flagged ${result.count} ticket(s) as legacy`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
