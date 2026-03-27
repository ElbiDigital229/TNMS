import { prisma } from "../../config/db.js";

export const dashboardService = {
  async getStats() {
    const [
      totalProperties,
      totalUnits,
      totalAssets,
      totalTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByTaskType,
      completedTickets,
    ] = await Promise.all([
      prisma.property.count(),
      prisma.unit.count(),
      prisma.asset.count(),
      prisma.ticket.count(),
      prisma.ticket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ["priority"],
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ["taskType"],
        _count: { id: true },
      }),
      prisma.ticket.findMany({
        where: { status: "COMPLETED" },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

    // Calculate completion rate
    const completionRate =
      totalTickets > 0
        ? Math.round((completedTickets.length / totalTickets) * 100)
        : 0;

    // Calculate average completion time (in hours)
    let avgCompletionTimeHours = 0;
    if (completedTickets.length > 0) {
      const totalMs = completedTickets.reduce((sum, t) => {
        return sum + (t.updatedAt.getTime() - t.createdAt.getTime());
      }, 0);
      avgCompletionTimeHours = Math.round(
        totalMs / completedTickets.length / (1000 * 60 * 60)
      );
    }

    // Format grouped data into objects
    const statusMap: Record<string, number> = {};
    ticketsByStatus.forEach((s) => {
      statusMap[s.status] = s._count.id;
    });

    const priorityMap: Record<string, number> = {};
    ticketsByPriority.forEach((p) => {
      priorityMap[p.priority] = p._count.id;
    });

    const taskTypeMap: Record<string, number> = {};
    ticketsByTaskType.forEach((t) => {
      taskTypeMap[t.taskType] = t._count.id;
    });

    // Recent tickets (last 5)
    const recentTickets = await prisma.ticket.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        property: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    // Overdue tickets count
    const overdueTickets = await prisma.ticket.count({
      where: {
        status: { not: "COMPLETED" },
        dueDate: { lt: new Date() },
      },
    });

    return {
      totals: {
        properties: totalProperties,
        units: totalUnits,
        assets: totalAssets,
        tickets: totalTickets,
      },
      tickets: {
        byStatus: {
          OPEN: statusMap.OPEN || 0,
          IN_PROGRESS: statusMap.IN_PROGRESS || 0,
          COMPLETED: statusMap.COMPLETED || 0,
        },
        byPriority: {
          CRITICAL: priorityMap.CRITICAL || 0,
          HIGH: priorityMap.HIGH || 0,
          MEDIUM: priorityMap.MEDIUM || 0,
          LOW: priorityMap.LOW || 0,
        },
        byTaskType: {
          COMPLAIN: taskTypeMap.COMPLAIN || 0,
          MAINTENANCE: taskTypeMap.MAINTENANCE || 0,
          INSPECT: taskTypeMap.INSPECT || 0,
          TASK: taskTypeMap.TASK || 0,
        },
        completionRate,
        avgCompletionTimeHours,
        overdue: overdueTickets,
      },
      recentTickets,
    };
  },
};
