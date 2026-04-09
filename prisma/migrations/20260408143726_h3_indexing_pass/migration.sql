/*
  Warnings:

  - You are about to drop the column `designation` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TICKET_MENTION';

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_unitId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_departmentId_fkey";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "legacy" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TicketComment" ADD COLUMN     "commenterId" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "designation",
ADD COLUMN     "designationId" TEXT,
ALTER COLUMN "departmentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Designation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Designation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Designation_name_key" ON "Designation"("name");

-- CreateIndex
CREATE INDEX "Asset_propertyId_status_idx" ON "Asset"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Asset_propertyId_categoryId_idx" ON "Asset"("propertyId", "categoryId");

-- CreateIndex
CREATE INDEX "Asset_floorId_idx" ON "Asset"("floorId");

-- CreateIndex
CREATE INDEX "Asset_categoryId_idx" ON "Asset"("categoryId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_module_createdAt_idx" ON "AuditLog"("module", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Floor_propertyId_idx" ON "Floor"("propertyId");

-- CreateIndex
CREATE INDEX "Property_areaGroupId_idx" ON "Property"("areaGroupId");

-- CreateIndex
CREATE INDEX "Property_city_status_idx" ON "Property"("city", "status");

-- CreateIndex
CREATE INDEX "Ticket_legacy_idx" ON "Ticket"("legacy");

-- CreateIndex
CREATE INDEX "Ticket_deletedAt_idx" ON "Ticket"("deletedAt");

-- CreateIndex
CREATE INDEX "Ticket_propertyId_status_idx" ON "Ticket"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Ticket_propertyId_createdAt_idx" ON "Ticket"("propertyId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Ticket_assignedToId_status_idx" ON "Ticket"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Ticket_status_dueDate_idx" ON "Ticket"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Ticket_createdById_idx" ON "Ticket"("createdById");

-- CreateIndex
CREATE INDEX "Ticket_categoryId_idx" ON "Ticket"("categoryId");

-- CreateIndex
CREATE INDEX "Ticket_departmentId_idx" ON "Ticket"("departmentId");

-- CreateIndex
CREATE INDEX "Ticket_unitId_idx" ON "Ticket"("unitId");

-- CreateIndex
CREATE INDEX "TicketActivity_ticketId_createdAt_idx" ON "TicketActivity"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketActivity_performedById_idx" ON "TicketActivity"("performedById");

-- CreateIndex
CREATE INDEX "TicketAsset_assetId_idx" ON "TicketAsset"("assetId");

-- CreateIndex
CREATE INDEX "TicketBlock_ticketId_idx" ON "TicketBlock"("ticketId");

-- CreateIndex
CREATE INDEX "TicketBlock_departmentId_idx" ON "TicketBlock"("departmentId");

-- CreateIndex
CREATE INDEX "TicketBlock_blockingUserId_idx" ON "TicketBlock"("blockingUserId");

-- CreateIndex
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketComment_commenterId_idx" ON "TicketComment"("commenterId");

-- CreateIndex
CREATE INDEX "Todo_userId_status_dueDate_idx" ON "Todo"("userId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");

-- CreateIndex
CREATE INDEX "Unit_floorId_idx" ON "Unit"("floorId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "User_designationId_idx" ON "User"("designationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "Designation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TicketCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_commenterId_fkey" FOREIGN KEY ("commenterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
