-- CreateEnum
CREATE TYPE "PpmStepStatus" AS ENUM ('PENDING', 'OK', 'NOT_OK', 'NA');

-- CreateTable
CREATE TABLE "Ppm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ppm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpmStep" (
    "id" TEXT NOT NULL,
    "ppmId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PpmStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketPpmStep" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "status" "PpmStepStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketPpmStep_pkey" PRIMARY KEY ("id")
);

-- Add ppmId to Ticket
ALTER TABLE "Ticket" ADD COLUMN "ppmId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Ppm_name_key" ON "Ppm"("name");
CREATE INDEX "PpmStep_ppmId_order_idx" ON "PpmStep"("ppmId", "order");
CREATE INDEX "TicketPpmStep_ticketId_order_idx" ON "TicketPpmStep"("ticketId", "order");
CREATE INDEX "Ticket_ppmId_idx" ON "Ticket"("ppmId");

-- AddForeignKey
ALTER TABLE "PpmStep" ADD CONSTRAINT "PpmStep_ppmId_fkey" FOREIGN KEY ("ppmId") REFERENCES "Ppm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketPpmStep" ADD CONSTRAINT "TicketPpmStep_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketPpmStep" ADD CONSTRAINT "TicketPpmStep_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ppmId_fkey" FOREIGN KEY ("ppmId") REFERENCES "Ppm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
