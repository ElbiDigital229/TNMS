-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TICKET_REASSIGNED_AWAY';
ALTER TYPE "NotificationType" ADD VALUE 'TICKET_EDITED';
ALTER TYPE "NotificationType" ADD VALUE 'TICKET_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'TICKET_OVERDUE_ESCALATION';
ALTER TYPE "NotificationType" ADD VALUE 'ASSET_CONDITION_POOR';
ALTER TYPE "NotificationType" ADD VALUE 'PROPERTY_DEACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_PASSWORD_RESET';
ALTER TYPE "NotificationType" ADD VALUE 'USER_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'USER_NEW_SUBORDINATE';
ALTER TYPE "NotificationType" ADD VALUE 'USER_CREATED_UNDER_YOU';
