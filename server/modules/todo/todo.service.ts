import { prisma } from "../../config/db.js";

export const todoService = {
  async findAll(
    userId: string,
    params: {
      period?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const where: any = { userId };

    // Status filter
    if (params.status === "OPEN") {
      where.status = "OPEN";
    } else if (params.status === "COMPLETED") {
      where.status = "COMPLETED";
    }

    // Period filter
    if (params.period === "today") {
      where.dueDate = { gte: startOfDay, lt: endOfDay };
      if (!params.status) where.status = "OPEN";
    } else if (params.period === "this_week") {
      where.dueDate = { gte: startOfWeek, lt: endOfWeek };
      if (!params.status) where.status = "OPEN";
    } else if (params.period === "overdue") {
      where.dueDate = { lt: startOfDay };
      where.status = "OPEN";
    } else if (params.period === "archived") {
      where.status = "COMPLETED";
    }

    const [todos, total] = await Promise.all([
      prisma.todo.findMany({
        where,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        skip,
        take: limit,
      }),
      prisma.todo.count({ where }),
    ]);

    return {
      data: todos,
      pagination: {
        total,
        totalPages: Math.ceil(total / limit),
        page,
        limit,
      },
    };
  },

  async getStats(userId: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [open, completed, overdue] = await Promise.all([
      prisma.todo.count({ where: { userId, status: "OPEN" } }),
      prisma.todo.count({ where: { userId, status: "COMPLETED" } }),
      prisma.todo.count({
        where: { userId, status: "OPEN", dueDate: { lt: startOfDay } },
      }),
    ]);

    // Tasks due today
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const dueToday = await prisma.todo.count({
      where: { userId, status: "OPEN", dueDate: { gte: startOfDay, lt: endOfDay } },
    });

    return { open, completed, overdue, dueToday };
  },

  async create(userId: string, title: string, dueDate: string) {
    return prisma.todo.create({
      data: {
        title,
        dueDate: new Date(dueDate),
        userId,
      },
    });
  },

  async update(id: string, userId: string, data: { title?: string; dueDate?: string }) {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    return prisma.todo.update({
      where: { id, userId },
      data: updateData,
    });
  },

  async complete(id: string, userId: string) {
    return prisma.todo.update({
      where: { id, userId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  },

  async reopen(id: string, userId: string) {
    return prisma.todo.update({
      where: { id, userId },
      data: { status: "OPEN", completedAt: null },
    });
  },

  async remove(id: string, userId: string) {
    return prisma.todo.delete({
      where: { id, userId },
    });
  },
};
