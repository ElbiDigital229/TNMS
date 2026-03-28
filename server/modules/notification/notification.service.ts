import { prisma } from "../../config/db.js";
import type { NotificationType } from "@prisma/client";

export const notificationService = {
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    linkUrl?: string;
    metadata?: Record<string, any>;
  }) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        linkUrl: params.linkUrl,
        metadata: params.metadata ?? undefined,
      },
    });
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

    return prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        linkUrl: n.linkUrl,
        metadata: n.metadata ?? undefined,
      })),
    });
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
