-- Make ticket fields nullable so only title, description, and property are required.
-- Enums get defaults so callers can omit them entirely.

ALTER TABLE "Ticket" ALTER COLUMN "unitId" DROP NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "categoryId" DROP NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "departmentId" DROP NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "dueDate" DROP NOT NULL;

ALTER TABLE "Ticket" ALTER COLUMN "taskType" SET DEFAULT 'TASK';
ALTER TABLE "Ticket" ALTER COLUMN "subTaskType" SET DEFAULT 'REACTIVE';
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
