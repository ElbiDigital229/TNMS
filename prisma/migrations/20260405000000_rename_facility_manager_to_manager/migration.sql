-- Rename "Facility Manager" role to "Manager"
UPDATE "Role" SET "name" = 'Manager' WHERE "name" = 'Facility Manager';

-- Also deactivate "City Head" role if it exists (no longer needed in new structure)
-- UPDATE "Role" SET "status" = 'INACTIVE' WHERE "name" = 'City Head';
