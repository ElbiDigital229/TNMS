-- Add headUserId to Department
ALTER TABLE "Department" ADD COLUMN "headUserId" TEXT;

-- Backfill: set headUserId to existing dept Manager (role.name = 'Manager')
UPDATE "Department" d
SET "headUserId" = sub."userId"
FROM (
  SELECT DISTINCT ON (u."departmentId") u."departmentId", u.id AS "userId"
  FROM "User" u
  JOIN "Role" r ON r.id = u."roleId"
  WHERE r.name = 'Manager' AND u.status = 'ACTIVE' AND u."departmentId" IS NOT NULL
  ORDER BY u."departmentId", u."createdAt" ASC
) sub
WHERE d.id = sub."departmentId";

-- Add FK constraint
ALTER TABLE "Department"
  ADD CONSTRAINT "Department_headUserId_fkey"
  FOREIGN KEY ("headUserId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop reportsTo from User
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_reportsToId_fkey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "reportsToId";
