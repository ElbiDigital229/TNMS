-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_floorId_fkey";

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "unitType" DROP NOT NULL,
ALTER COLUMN "floorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
