-- Drop role hierarchy: authorization is now permissions-only.
ALTER TABLE "Role" DROP COLUMN "level";
ALTER TABLE "Role" DROP COLUMN "canAssignToMaxLevel";
