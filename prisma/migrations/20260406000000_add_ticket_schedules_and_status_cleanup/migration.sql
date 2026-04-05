-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- AlterEnum
BEGIN;
CREATE TYPE "TicketStatus_new" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');
ALTER TABLE "public"."Ticket" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus_new" USING ("status"::text::"TicketStatus_new");
ALTER TABLE "TicketBlock" ALTER COLUMN "previousStatus" TYPE "TicketStatus_new" USING ("previousStatus"::text::"TicketStatus_new");
ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
ALTER TYPE "TicketStatus_new" RENAME TO "TicketStatus";
DROP TYPE "public"."TicketStatus_old";
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'UNASSIGNED';
COMMIT;

-- AlterTable
ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'UNASSIGNED';

-- CreateTable
CREATE TABLE "TicketSchedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "categoryId" TEXT,
    "departmentId" TEXT,
    "assignedToId" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "taskType" "TaskType" NOT NULL,
    "subTaskType" "SubTaskType" NOT NULL DEFAULT 'PREVENTIVE',
    "frequency" "ScheduleFrequency" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "monthOfYear" INTEGER,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketSchedule_nextRunAt_isActive_idx" ON "TicketSchedule"("nextRunAt", "isActive");

-- CreateIndex
CREATE INDEX "TicketSchedule_propertyId_idx" ON "TicketSchedule"("propertyId");

-- AddForeignKey
ALTER TABLE "TicketSchedule" ADD CONSTRAINT "TicketSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSchedule" ADD CONSTRAINT "TicketSchedule_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSchedule" ADD CONSTRAINT "TicketSchedule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSchedule" ADD CONSTRAINT "TicketSchedule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSchedule" ADD CONSTRAINT "TicketSchedule_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSchedule" ADD CONSTRAINT "TicketSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

