-- Step 1: Add floorId as nullable
ALTER TABLE "Asset" ADD COLUMN "floorId" TEXT;

-- Step 2: Populate floorId from the related Unit's floorId
UPDATE "Asset" a
SET "floorId" = u."floorId"
FROM "Unit" u
WHERE a."unitId" = u."id" AND u."floorId" IS NOT NULL;

-- Step 3: For any assets where the unit had no floor, assign the first floor of the property
UPDATE "Asset" a
SET "floorId" = (
  SELECT f."id" FROM "Floor" f
  WHERE f."propertyId" = a."propertyId" AND f."status" = 'ACTIVE'
  ORDER BY f."createdAt" ASC
  LIMIT 1
)
WHERE a."floorId" IS NULL;

-- Step 4: Make floorId required
ALTER TABLE "Asset" ALTER COLUMN "floorId" SET NOT NULL;

-- Step 5: Drop the old unitId column and its foreign key
ALTER TABLE "Asset" DROP CONSTRAINT IF EXISTS "Asset_unitId_fkey";
ALTER TABLE "Asset" DROP COLUMN "unitId";

-- Step 6: Add foreign key for floorId
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
