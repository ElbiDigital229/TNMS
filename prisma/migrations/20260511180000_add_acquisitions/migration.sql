-- CreateEnum
CREATE TYPE "AcquisitionSourceType" AS ENUM ('BROKER', 'OWNER', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "AcquisitionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LandZoning" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE');

-- CreateEnum
CREATE TYPE "LandProposedModel" AS ENUM ('JV', 'DEVELOPMENT', 'SALE');

-- CreateEnum
CREATE TYPE "BuildingStatus" AS ENUM ('READY', 'UNDER_CONSTRUCTION');

-- CreateEnum
CREATE TYPE "BuildingProposedModel" AS ENUM ('LEASE', 'JV', 'OPERATOR');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('REVIEW', 'VISIT', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');

-- CreateEnum
CREATE TYPE "UtilityType" AS ENUM ('WATER', 'GAS', 'ELECTRICITY', 'SEWERAGE', 'INTERNET', 'PHONE', 'BOREWELL', 'SOLAR');

-- CreateTable
CREATE TABLE "AcquisitionAgent" (
    "id" TEXT NOT NULL,
    "agentCode" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "companyName" TEXT,
    "contactNumber" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "areaFocus" TEXT,
    "sourceType" "AcquisitionSourceType" NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 3,
    "firstContactDate" TIMESTAMP(3),
    "status" "AcquisitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastAvailabilityCheck" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AcquisitionAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcquisitionLand" (
    "id" TEXT NOT NULL,
    "landCode" TEXT NOT NULL,
    "agentId" TEXT,
    "city" TEXT NOT NULL,
    "areaLocation" TEXT,
    "addressDescription" TEXT,
    "coordinates" TEXT,
    "plotSizeKanal" DECIMAL(10,2),
    "frontRoadWidthFt" DECIMAL(6,2),
    "zoning" "LandZoning",
    "developmentStatus" TEXT,
    "maxCoveredAreaSqft" DECIMAL(12,2),
    "utilities" "UtilityType"[],
    "parkingPotential" TEXT,
    "proposedModel" "LandProposedModel",
    "askingPrice" DECIMAL(18,2),
    "ownerFlexibility" TEXT,
    "stage" "DealStage" NOT NULL DEFAULT 'REVIEW',
    "status" "AcquisitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastAvailabilityCheck" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AcquisitionLand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcquisitionBuilding" (
    "id" TEXT NOT NULL,
    "buildingCode" TEXT NOT NULL,
    "agentId" TEXT,
    "city" TEXT NOT NULL,
    "areaLocation" TEXT,
    "propertyAddress" TEXT,
    "coordinates" TEXT,
    "coveredAreaSqft" DECIMAL(12,2),
    "plotSizeKanal" DECIMAL(10,2),
    "floors" INTEGER,
    "floorPlateSizeSqft" DECIMAL(12,2),
    "parkingCapacity" INTEGER,
    "buildingStatus" "BuildingStatus",
    "possessionTimeline" TEXT,
    "utilities" "UtilityType"[],
    "powerBackup" TEXT,
    "elevators" INTEGER,
    "proposedModel" "BuildingProposedModel",
    "askingRent" DECIMAL(18,2),
    "stage" "DealStage" NOT NULL DEFAULT 'REVIEW',
    "status" "AcquisitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastAvailabilityCheck" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AcquisitionBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcquisitionAgent_agentCode_key" ON "AcquisitionAgent"("agentCode");

-- CreateIndex
CREATE INDEX "AcquisitionAgent_status_deletedAt_idx" ON "AcquisitionAgent"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "AcquisitionAgent_city_idx" ON "AcquisitionAgent"("city");

-- CreateIndex
CREATE INDEX "AcquisitionAgent_sourceType_idx" ON "AcquisitionAgent"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AcquisitionLand_landCode_key" ON "AcquisitionLand"("landCode");

-- CreateIndex
CREATE INDEX "AcquisitionLand_agentId_idx" ON "AcquisitionLand"("agentId");

-- CreateIndex
CREATE INDEX "AcquisitionLand_status_deletedAt_idx" ON "AcquisitionLand"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "AcquisitionLand_stage_idx" ON "AcquisitionLand"("stage");

-- CreateIndex
CREATE INDEX "AcquisitionLand_city_idx" ON "AcquisitionLand"("city");

-- CreateIndex
CREATE UNIQUE INDEX "AcquisitionBuilding_buildingCode_key" ON "AcquisitionBuilding"("buildingCode");

-- CreateIndex
CREATE INDEX "AcquisitionBuilding_agentId_idx" ON "AcquisitionBuilding"("agentId");

-- CreateIndex
CREATE INDEX "AcquisitionBuilding_status_deletedAt_idx" ON "AcquisitionBuilding"("status", "deletedAt");

-- CreateIndex
CREATE INDEX "AcquisitionBuilding_stage_idx" ON "AcquisitionBuilding"("stage");

-- CreateIndex
CREATE INDEX "AcquisitionBuilding_city_idx" ON "AcquisitionBuilding"("city");

-- AddForeignKey
ALTER TABLE "AcquisitionLand" ADD CONSTRAINT "AcquisitionLand_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AcquisitionAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcquisitionBuilding" ADD CONSTRAINT "AcquisitionBuilding_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AcquisitionAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
