import { prisma } from "../../config/db.js";
import { rbacService } from "../../services/rbac.service.js";

export const dashboardService = {
  async getStats(userId: string, isSuperAdmin: boolean, allProperties: boolean, roleLevel: number) {
    // Build property scope filter
    let scopeFilter: any = {};
    if (!isSuperAdmin && !allProperties) {
      const propertyIds = await rbacService.getUserPropertyIds(userId);
      if (propertyIds !== "all") {
        scopeFilter.propertyId = { in: propertyIds as string[] };
      }
    }

    // Build ticket-specific scope: levels 5 and 6 (Supervisor/Technician) see only their own assigned tickets
    let ticketScopeFilter: any = { ...scopeFilter };
    if (roleLevel >= 5) {
      ticketScopeFilter.assignedToId = userId;
    }

    // Build where clauses for property/unit/asset counts
    const propertyWhere = !isSuperAdmin && !allProperties && scopeFilter.propertyId
      ? { id: scopeFilter.propertyId }
      : {};
    const unitAssetWhere = !isSuperAdmin && !allProperties && scopeFilter.propertyId
      ? { propertyId: scopeFilter.propertyId }
      : {};

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
      prisma.property.count({ where: propertyWhere }),
      prisma.unit.count({ where: unitAssetWhere }),
      prisma.asset.count({ where: unitAssetWhere }),
      prisma.ticket.count({ where: ticketScopeFilter }),
      prisma.ticket.groupBy({
        by: ["status"],
        where: ticketScopeFilter,
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ["priority"],
        where: ticketScopeFilter,
        _count: { id: true },
      }),
      prisma.ticket.groupBy({
        by: ["taskType"],
        where: ticketScopeFilter,
        _count: { id: true },
      }),
      prisma.ticket.findMany({
        where: { ...ticketScopeFilter, status: "COMPLETED" },
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
      where: ticketScopeFilter,
      orderBy: { createdAt: "desc" },
      include: {
        property: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    // Overdue tickets count
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdueTickets = await prisma.ticket.count({
      where: {
        ...ticketScopeFilter,
        status: { not: "COMPLETED" },
        dueDate: { lt: startOfToday },
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
          UNASSIGNED: statusMap.UNASSIGNED || 0,
          ASSIGNED: statusMap.ASSIGNED || 0,
          IN_PROGRESS: statusMap.IN_PROGRESS || 0,
          BLOCKED: statusMap.BLOCKED || 0,
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
