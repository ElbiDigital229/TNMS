import { prisma } from "../config/db.js";
import { notificationService } from "../modules/notification/notification.service.js";
import { rbacService } from "./rbac.service.js";
import type { NotificationType } from "@prisma/client";

// Helper: get display name
async function getUserName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, username: true },
  });
  return u?.fullName || u?.username || "Someone";
}

// Helper: get users with tickets.view_all for a property (+ super admins)
// Respects inherited property access via reporting chain
async function getPropertyTicketViewers(
  propertyId: string,
  excludeUserId?: string
): Promise<string[]> {
  const candidates = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: [
        { isSuperAdmin: true },
        { role: { permissions: { some: { permission: { key: "tickets.view_all" } } } } },
      ],
    },
    select: { id: true, isSuperAdmin: true },
  });

  const ids: string[] = [];
  for (const c of candidates) {
    if (c.isSuperAdmin || await rbacService.userHasPropertyAccess(c.id, propertyId)) {
      ids.push(c.id);
    }
  }
  return ids;
}

/**
 * Notification trigger service — determines WHO gets notified and WHAT they see.
 * All methods are designed to be called fire-and-forget: `.catch(console.error)`
 */
export const notificationTrigger = {
  // ─── TICKET EVENTS ──────────────────────────────────────

  /** #1 Ticket assigned to someone */
  async onTicketAssigned(
    ticketId: string,
    assigneeId: string,
    assignerUserId: string,
    previousAssigneeId?: string | null
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ticketNumber: true,
        name: true,
        property: { select: { name: true } },
      },
    });
    if (!ticket) return;

    const assignerName = await getUserName(assignerUserId);
    const notifications: Parameters<typeof notificationService.createMany>[0] = [];

    // Notify new assignee (unless self-assign)
    if (assigneeId !== assignerUserId) {
      notifications.push({
        userId: assigneeId,
        type: "TICKET_ASSIGNED" as NotificationType,
        title: "Ticket Assigned to You",
        message: `${assignerName} assigned ${ticket.ticketNumber} — "${ticket.name}" to you`,
        linkUrl: `/tickets/${ticketId}`,
        metadata: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          propertyName: ticket.property.name,
          assignerName,
        },
      });
    }

    // #8 Notify previous assignee they were reassigned away
    if (
      previousAssigneeId &&
      previousAssigneeId !== assigneeId &&
      previousAssigneeId !== assignerUserId
    ) {
      const newAssigneeName = await getUserName(assigneeId);
      notifications.push({
        userId: previousAssigneeId,
        type: "TICKET_REASSIGNED_AWAY" as NotificationType,
        title: "Ticket Reassigned",
        message: `${ticket.ticketNumber} — "${ticket.name}" was reassigned to ${newAssigneeName}`,
        linkUrl: `/tickets/${ticketId}`,
        metadata: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          newAssigneeName,
        },
      });
    }

    if (notifications.length > 0) {
      await notificationService.createMany(notifications);
    }
  },

  /** #2 Ticket status changed */
  async onTicketStatusChanged(
    ticketId: string,
    newStatus: string,
    changerUserId: string
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ticketNumber: true,
        name: true,
        createdById: true,
        assignedToId: true,
        property: { select: { name: true } },
      },
    });
    if (!ticket) return;

    const changerName = await getUserName(changerUserId);
    const statusLabel = newStatus.replace(/_/g, " ").toLowerCase();

    const recipientIds = new Set<string>();
    if (ticket.createdById) recipientIds.add(ticket.createdById);
    if (ticket.assignedToId) recipientIds.add(ticket.assignedToId);
    recipientIds.delete(changerUserId);

    if (recipientIds.size === 0) return;

    await notificationService.createMany(
      [...recipientIds].map((userId) => ({
        userId,
        type: "TICKET_STATUS_CHANGED" as NotificationType,
        title: "Ticket Status Updated",
        message: `${changerName} changed ${ticket.ticketNumber} to ${statusLabel}`,
        linkUrl: `/tickets/${ticketId}`,
        metadata: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          newStatus,
          changerName,
          propertyName: ticket.property.name,
        },
      }))
    );
  },

  /** #3 New comment added to a ticket */
  async onTicketCommentAdded(ticketId: string, commenterUserId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ticketNumber: true,
        name: true,
        createdById: true,
        assignedToId: true,
        property: { select: { name: true } },
      },
    });
    if (!ticket) return;

    const commenterName = await getUserName(commenterUserId);

    const recipientIds = new Set<string>();
    if (ticket.createdById) recipientIds.add(ticket.createdById);
    if (ticket.assignedToId) recipientIds.add(ticket.assignedToId);
    recipientIds.delete(commenterUserId);

    if (recipientIds.size === 0) return;

    await notificationService.createMany(
      [...recipientIds].map((userId) => ({
        userId,
        type: "TICKET_COMMENT" as NotificationType,
        title: "New Comment on Ticket",
        message: `${commenterName} commented on ${ticket.ticketNumber} — "${ticket.name}"`,
        linkUrl: `/tickets/${ticketId}`,
        metadata: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          commenterName,
          propertyName: ticket.property.name,
        },
      }))
    );
  },

  /** #4 Ticket created in a property */
  async onTicketCreated(ticketId: string, creatorUserId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ticketNumber: true,
        name: true,
        propertyId: true,
        property: { select: { name: true } },
        priority: true,
      },
    });
    if (!ticket) return;

    const creatorName = await getUserName(creatorUserId);
    const recipientIds = await getPropertyTicketViewers(
      ticket.propertyId,
      creatorUserId
    );

    if (recipientIds.length === 0) return;

    await notificationService.createMany(
      recipientIds.map((userId) => ({
        userId,
        type: "TICKET_CREATED_IN_PROPERTY" as NotificationType,
        title: "New Ticket Created",
        message: `${creatorName} created ${ticket.ticketNumber} — "${ticket.name}" in ${ticket.property.name}`,
        linkUrl: `/tickets/${ticketId}`,
        metadata: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          propertyName: ticket.property.name,
          priority: ticket.priority,
          creatorName,
        },
      }))
    );
  },

  /** #9 Ticket edited (details changed) */
  async onTicketEdited(ticketId: string, editorUserId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ticketNumber: true,
        name: true,
        assignedToId: true,
        createdById: true,
        property: { select: { name: true } },
      },
    });
    if (!ticket) return;

    // Only notify assignee if they're not the editor
    if (!ticket.assignedToId || ticket.assignedToId === editorUserId) return;

    const editorName = await getUserName(editorUserId);

    await notificationService.create({
      userId: ticket.assignedToId,
      type: "TICKET_EDITED" as NotificationType,
      title: "Ticket Details Updated",
      message: `${editorName} updated ${ticket.ticketNumber} — "${ticket.name}"`,
      linkUrl: `/tickets/${ticketId}`,
      metadata: {
        ticketId,
        ticketNumber: ticket.ticketNumber,
        editorName,
      },
    });
  },

  // ─── SCHEDULED TICKET EVENTS (cron) ─────────────────────

  /** #6 Ticket overdue — notify assignee + creator + assignee's manager */
  async checkOverdueTickets() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Overdue is now computed live — no status mutation needed.
    // Find all non-completed tickets past due date.
    const overdueTickets = await prisma.ticket.findMany({
      where: {
        dueDate: { lt: startOfToday },
        status: { not: "COMPLETED" },
      },
      select: {
        id: true,
        ticketNumber: true,
        name: true,
        dueDate: true,
        assignedToId: true,
        createdById: true,
        propertyId: true,
        departmentId: true,
        property: { select: { name: true } },
        department: { select: { headUserId: true } },
      },
    });

    for (const ticket of overdueTickets) {
      // Check if we already sent an overdue notification today for this ticket
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existing = await prisma.notification.findFirst({
        where: {
          type: "TICKET_OVERDUE",
          createdAt: { gte: todayStart },
          metadata: { path: ["ticketId"], equals: ticket.id },
        },
      });
      if (existing) continue; // Already notified today

      const recipients = new Set<string>();
      if (ticket.assignedToId) recipients.add(ticket.assignedToId);
      if (ticket.createdById) recipients.add(ticket.createdById);

      if (recipients.size === 0) continue;

      const daysOverdue = Math.ceil(
        (now.getTime() - ticket.dueDate!.getTime()) / 86400000
      );

      await notificationService.createMany(
        [...recipients].map((userId) => ({
          userId,
          type: "TICKET_OVERDUE" as NotificationType,
          title: "Ticket Overdue",
          message: `${ticket.ticketNumber} — "${ticket.name}" is ${daysOverdue} day(s) overdue`,
          linkUrl: `/tickets/${ticket.id}`,
          metadata: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            daysOverdue,
            propertyName: ticket.property.name,
          },
        }))
      );

      // #10 Escalation: notify the department head if not already a recipient
      const headId = ticket.department?.headUserId;
      if (headId && !recipients.has(headId)) {
        await notificationService.create({
          userId: headId,
          type: "TICKET_OVERDUE_ESCALATION" as NotificationType,
          title: "Department Ticket Overdue",
          message: `${ticket.ticketNumber} — "${ticket.name}" in your department is ${daysOverdue} day(s) overdue`,
          linkUrl: `/tickets/${ticket.id}`,
          metadata: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            daysOverdue,
            propertyName: ticket.property.name,
          },
        });
      }
    }

    return overdueTickets.length;
  },

  /** #7 Ticket due soon (24h warning) */
  async checkDueSoonTickets() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const dueSoonTickets = await prisma.ticket.findMany({
      where: {
        dueDate: { gt: now, lte: in24h },
        status: { not: "COMPLETED" },
        assignedToId: { not: null },
      },
      select: {
        id: true,
        ticketNumber: true,
        name: true,
        dueDate: true,
        assignedToId: true,
        property: { select: { name: true } },
      },
    });

    for (const ticket of dueSoonTickets) {
      // Check if already notified for this ticket
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const existing = await prisma.notification.findFirst({
        where: {
          type: "TICKET_DUE_SOON",
          userId: ticket.assignedToId!,
          createdAt: { gte: todayStart },
          metadata: { path: ["ticketId"], equals: ticket.id },
        },
      });
      if (existing) continue;

      const hoursLeft = Math.round(
        (ticket.dueDate!.getTime() - now.getTime()) / 3600000
      );

      await notificationService.create({
        userId: ticket.assignedToId!,
        type: "TICKET_DUE_SOON" as NotificationType,
        title: "Ticket Due Soon",
        message: `${ticket.ticketNumber} — "${ticket.name}" is due in ${hoursLeft} hour(s)`,
        linkUrl: `/tickets/${ticket.id}`,
        metadata: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          hoursLeft,
          propertyName: ticket.property.name,
        },
      });
    }

    return dueSoonTickets.length;
  },

  /** Ticket blocked — notify the blocking user */
  async onTicketBlocked(ticketId: string, blockedById: string, blockingUserId: string, reason: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { ticketNumber: true, name: true, property: { select: { name: true } } },
    });
    if (!ticket) return;

    const blockedByName = await getUserName(blockedById);

    await notificationService.create({
      userId: blockingUserId,
      type: "TICKET_BLOCKED" as NotificationType,
      title: "Action Required — Ticket Blocked",
      message: `${blockedByName} is blocked on ${ticket.ticketNumber} — "${ticket.name}" and needs your help: ${reason}`,
      linkUrl: `/tickets/${ticketId}`,
      metadata: { ticketId, ticketNumber: ticket.ticketNumber, blockedById, reason },
    });
  },

  /** Ticket unblocked — notify the person who raised the block */
  async onTicketUnblocked(ticketId: string, resolvedById: string, blockedById: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { ticketNumber: true, name: true },
    });
    if (!ticket) return;

    if (resolvedById === blockedById) return; // no need to notify yourself

    const resolvedByName = await getUserName(resolvedById);

    await notificationService.create({
      userId: blockedById,
      type: "TICKET_UNBLOCKED" as NotificationType,
      title: "Ticket Unblocked",
      message: `${resolvedByName} resolved the block on ${ticket.ticketNumber} — "${ticket.name}"`,
      linkUrl: `/tickets/${ticketId}`,
      metadata: { ticketId, ticketNumber: ticket.ticketNumber, resolvedById },
    });
  },

  /** Mentioned in a ticket comment */
  async onTicketMention(
    ticketId: string,
    mentionedUserIds: string[],
    commenterUserId: string
  ) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        ticketNumber: true,
        name: true,
        property: { select: { name: true } },
      },
    });
    if (!ticket) return;

    const commenterName = await getUserName(commenterUserId);

    // Exclude the commenter from receiving a mention notification
    const recipients = mentionedUserIds.filter((id) => id !== commenterUserId);
    if (recipients.length === 0) return;

    await notificationService.createMany(
      recipients.map((userId) => ({
        userId,
        type: "TICKET_MENTION" as NotificationType,
        title: "You Were Mentioned",
        message: `${commenterName} mentioned you in a comment on ${ticket.ticketNumber} — "${ticket.name}"`,
        linkUrl: `/tickets/${ticketId}`,
        metadata: {
          ticketId,
          ticketNumber: ticket.ticketNumber,
          commenterName,
          propertyName: ticket.property.name,
        },
      }))
    );
  },

  // ─── ASSET EVENTS ───────────────────────────────────────

  /** #12 Asset condition marked POOR */
  async onAssetConditionPoor(
    assetId: string,
    assetName: string,
    assetCode: string,
    propertyId: string
  ) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { name: true },
    });

    const recipientIds = await getPropertyTicketViewers(propertyId);
    if (recipientIds.length === 0) return;

    await notificationService.createMany(
      recipientIds.map((userId) => ({
        userId,
        type: "ASSET_CONDITION_POOR" as NotificationType,
        title: "Asset in Poor Condition",
        message: `${assetCode} — "${assetName}" in ${property?.name || "Unknown"} is marked as POOR condition`,
        linkUrl: `/assets/${assetCode}`,
        metadata: {
          assetId,
          assetCode,
          assetName,
          propertyName: property?.name,
        },
      }))
    );
  },

  // ─── PROPERTY EVENTS ───────────────────────────────────

  /** #13 Property deactivated */
  async onPropertyDeactivated(propertyId: string, propertyName: string) {
    // Notify all users assigned to this property
    const assignments = await prisma.userPropertyAssignment.findMany({
      where: { propertyId },
      select: { userId: true },
    });

    // Also notify users with allProperties
    const allPropUsers = await prisma.user.findMany({
      where: { allProperties: true, status: "ACTIVE", isSuperAdmin: false },
      select: { id: true },
    });

    const recipientIds = new Set([
      ...assignments.map((a) => a.userId),
      ...allPropUsers.map((u) => u.id),
    ]);

    if (recipientIds.size === 0) return;

    await notificationService.createMany(
      [...recipientIds].map((userId) => ({
        userId,
        type: "PROPERTY_DEACTIVATED" as NotificationType,
        title: "Property Deactivated",
        message: `"${propertyName}" has been deactivated`,
        linkUrl: `/properties`,
        metadata: { propertyId, propertyName },
      }))
    );
  },

  // ─── USER / ADMIN EVENTS ───────────────────────────────

  /** #5 User account changed (role, properties) */
  async onUserAccountChanged(userId: string, changeDescription: string) {
    await notificationService.create({
      userId,
      type: "USER_ACCOUNT_CHANGED" as NotificationType,
      title: "Account Updated",
      message: changeDescription,
      metadata: { changeDescription },
    });
  },

  /** #14 Password reset by admin */
  async onPasswordReset(userId: string, resetByUserId: string) {
    const resetByName = await getUserName(resetByUserId);

    await notificationService.create({
      userId,
      type: "USER_PASSWORD_RESET" as NotificationType,
      title: "Password Reset",
      message: `Your password was reset by ${resetByName}`,
      metadata: { resetByName },
    });
  },

  /** #15 Account blocked/deactivated — notify the user */
  async onUserStatusChanged(
    userId: string,
    newStatus: string,
    _changedByUserId: string
  ) {
    const statusLabel = newStatus.toLowerCase();

    await notificationService.create({
      userId,
      type: "USER_STATUS_CHANGED" as NotificationType,
      title: "Account Status Changed",
      message: `Your account has been ${statusLabel}`,
      metadata: { newStatus },
    });
  },
};
