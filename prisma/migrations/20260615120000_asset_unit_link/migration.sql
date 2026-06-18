-- Add an optional Unit linkage to Asset, so an asset (e.g. an AC, fan,
-- furniture item) can be tied to a specific Unit inside the floor it
-- already belongs to. NULL means the asset is floor-wide (lobby AC,
-- fire panel, etc.) and isn't bound to any single unit.
--
-- ON DELETE SET NULL — if a Unit is hard-deleted we keep the asset row
-- but drop its dangling reference; matches the existing soft-delete /
-- restore semantics elsewhere.

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "unitId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_unitId_idx" ON "Asset"("unitId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
