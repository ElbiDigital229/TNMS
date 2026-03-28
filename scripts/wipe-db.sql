-- Wipe all data except admin user, roles, and permissions
-- Order matters due to foreign key constraints

-- 1. Delete ticket-related data first (cascade-safe but explicit)
DELETE FROM "TicketAsset";
DELETE FROM "TicketComment";
DELETE FROM "TicketActivity";
DELETE FROM "Ticket";
DELETE FROM "TicketCategory";

-- 2. Delete assets and asset categories
DELETE FROM "Asset";
DELETE FROM "AssetCategory";

-- 3. Delete units, floors, properties, area groups
DELETE FROM "Unit";
DELETE FROM "Floor";
DELETE FROM "UserPropertyAssignment";
DELETE FROM "Property";
DELETE FROM "AreaGroup";

-- 4. Delete todos
DELETE FROM "Todo";

-- 5. Delete audit logs
DELETE FROM "AuditLog";

-- 6. Delete all users except admin
DELETE FROM "User" WHERE username != 'admin';

-- 7. Delete non-Super Admin roles and their permissions
DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT id FROM "Role" WHERE name != 'Super Admin');
DELETE FROM "Role" WHERE name != 'Super Admin';

-- Verify what's left
SELECT 'Users remaining:' AS info, COUNT(*) FROM "User";
SELECT 'Roles remaining:' AS info, COUNT(*) FROM "Role";
SELECT 'Permissions remaining:' AS info, COUNT(*) FROM "Permission";
