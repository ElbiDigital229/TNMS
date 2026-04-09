-- Manual migration: Refactor TicketStatus enum
-- OPEN -> UNASSIGNED/ASSIGNED, OVERDUE -> computed live, add BLOCKED
-- Run this BEFORE prisma db push

-- Step 1: Add new enum values
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'UNASSIGNED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

-- Step 2: Migrate existing data
-- OPEN tickets with an assignee -> ASSIGNED
UPDATE "Ticket" SET status = 'ASSIGNED' WHERE status = 'OPEN' AND "assignedToId" IS NOT NULL;
-- OPEN tickets without an assignee -> UNASSIGNED
UPDATE "Ticket" SET status = 'UNASSIGNED' WHERE status = 'OPEN' AND "assignedToId" IS NULL;

-- OVERDUE tickets with an assignee -> ASSIGNED (urgency computed live)
UPDATE "Ticket" SET status = 'ASSIGNED' WHERE status = 'OVERDUE' AND "assignedToId" IS NOT NULL;
-- OVERDUE tickets without an assignee -> UNASSIGNED
UPDATE "Ticket" SET status = 'UNASSIGNED' WHERE status = 'OVERDUE' AND "assignedToId" IS NULL;

-- Step 3: Migrate TicketBlock.previousStatus values
UPDATE "TicketBlock" SET "previousStatus" = 'ASSIGNED'
  WHERE "previousStatus" = 'OPEN'
  AND "ticketId" IN (SELECT id FROM "Ticket" WHERE "assignedToId" IS NOT NULL);

UPDATE "TicketBlock" SET "previousStatus" = 'UNASSIGNED'
  WHERE "previousStatus" = 'OPEN'
  AND "ticketId" IN (SELECT id FROM "Ticket" WHERE "assignedToId" IS NULL);

UPDATE "TicketBlock" SET "previousStatus" = 'ASSIGNED'
  WHERE "previousStatus" = 'OVERDUE'
  AND "ticketId" IN (SELECT id FROM "Ticket" WHERE "assignedToId" IS NOT NULL);

UPDATE "TicketBlock" SET "previousStatus" = 'UNASSIGNED'
  WHERE "previousStatus" = 'OVERDUE'
  AND "ticketId" IN (SELECT id FROM "Ticket" WHERE "assignedToId" IS NULL);

-- Step 4: Now safe to remove old values
-- NOTE: PostgreSQL doesn't support DROP VALUE from enums directly.
-- The old values (OPEN, OVERDUE) will remain in the enum but won't be used.
-- prisma db push will handle the final enum sync.
