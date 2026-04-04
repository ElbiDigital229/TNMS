import { prisma } from "../../config/db.js";
import type { NotificationType } from "@prisma/client";
import { fcmService } from "../../services/fcm.service.js";

export const notificationService = {
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    linkUrl?: string;
    metadata?: Record<string, any>;
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        linkUrl: params.linkUrl,
        metadata: params.metadata ?? undefined,
      },
    });

    // Send push notification (fire and forget)
    fcmService.sendToUser(params.userId, {
      title: params.title,
      body: params.message,
      data: {
        type: params.type,
        notificationId: notification.id,
        ...(params.linkUrl ? { linkUrl: params.linkUrl } : {}),
      },
    }).catch(() => {}); // Never block on push failure

    return notification;
  },

  async createMany(
    notifications: {
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      linkUrl?: string;
      metadata?: Record<string, any>;
    }[]
  ) {
    if (notifications.length === 0) return;

    const result = await prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        linkUrl: n.linkUrl,
        metadata: n.metadata ?? undefined,
      })),
    });

    // Send push notifications to all unique users (fire and forget)
    const uniqueUserIds = [...new Set(notifications.map((n) => n.userId))];
    for (const userId of uniqueUserIds) {
      const userNotifs = notifications.filter((n) => n.userId === userId);
      const first = userNotifs[0];
      const body = userNotifs.length > 1
        ? `${first.message} (+${userNotifs.length - 1} more)`
        : first.message;

      fcmService.sendToUser(userId, {
        title: first.title,
        body,
        data: {
          type: first.type,
          ...(first.linkUrl ? { linkUrl: first.linkUrl } : {}),
        },
      }).catch(() => {});
    }

    return result;
  },

  async findByUser(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      isRead?: boolean;
      type?: NotificationType;
    } = {}
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (params.isRead !== undefined) where.isRead = params.isRead;
    if (params.type) where.type = params.type;

    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  },

  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async deleteOld(daysToKeep = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    return prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
  },
};
