import { prisma } from "../../config/db.js";
import { rbacService } from "../../services/rbac.service.js";

// ─── Types ───────────────────────────────────────────────
type Entity = "tickets" | "assets" | "properties" | "units" | "users";
type Measure = "count" | "avg_completion_time" | "breakdown" | "overdue_count" | "completed_late" | "trend";
type Operator = "eq" | "in" | "between" | "gte" | "lte";
type SortOrder = "asc" | "desc";
type Granularity = "daily" | "weekly" | "monthly";

interface ReportFilter {
  field: string;
  operator: Operator;
  value: any;
}

export interface ReportQuery {
  entity: Entity;
  measure: Measure;
  groupBy: string;
  filters: ReportFilter[];
  sortOrder: SortOrder;
  limit: number;
  granularity?: Granularity;
  trendStart?: string;
  trendEnd?: string;
}

// ─── Allowlists ──────────────────────────────────────────
const GROUP_BY_ALLOWLIST: Record<Entity, string[]> = {
  tickets: ["assignedTo", "createdBy", "property", "unit", "category", "status", "priority", "department"],
  assets: ["property", "category", "condition", "floor"],
  properties: ["city", "areaGroup", "status", "type"],
  units: ["property", "floor", "type", "status"],
  users: ["department", "role", "status", "createdMonth"],
};

const FILTER_FIELD_ALLOWLIST: Record<Entity, string[]> = {
  tickets: ["propertyId", "unitId", "assignedToId", "createdById", "categoryId", "departmentId", "status", "priority", "createdAt", "dueDate"],
  assets: ["propertyId", "categoryId", "status", "condition", "purchaseDate"],
  properties: ["city", "areaGroupId", "status", "type"],
  units: ["propertyId", "floorId", "status", "type"],
  users: ["departmentId", "roleId", "status", "createdAt"],
};

const DATE_FIELDS = ["createdAt", "purchaseDate", "dueDate"];
const MAX_LIMIT = 100;

// ─── Helpers ─────────────────────────────────────────────

function getTomorrow(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 1);
  return t;
}

function validateAllowlist(entity: Entity, groupBy: string, filters: ReportFilter[], measure: Measure): string | null {
  if (measure === "trend") return null; // trend uses date grouping, not field grouping
  const allowedGroupBy = GROUP_BY_ALLOWLIST[entity];
  if (!allowedGroupBy.includes(groupBy)) {
    return `Invalid groupBy "${groupBy}" for entity "${entity}". Allowed: ${allowedGroupBy.join(", ")}`;
  }
  const allowedFilters = FILTER_FIELD_ALLOWLIST[entity];
  for (const filter of filters) {
    if (!allowedFilters.includes(filter.field)) {
      return `Invalid filter field "${filter.field}" for entity "${entity}". Allowed: ${allowedFilters.join(", ")}`;
    }
  }
  return null;
}

function buildPrismaWhere(filters: ReportFilter[]): any {
  const where: any = {};
  for (const filter of filters) {
    switch (filter.operator) {
      case "eq":
        where[filter.field] = filter.value;
        break;
      case "in":
        where[filter.field] = { in: filter.value };
        break;
      case "between":
        where[filter.field] = {
          gte: DATE_FIELDS.includes(filter.field) ? new Date(filter.value[0]) : filter.value[0],
          lte: DATE_FIELDS.includes(filter.field) ? new Date(filter.value[1]) : filter.value[1],
        };
        break;
      case "gte":
        where[filter.field] = { gte: DATE_FIELDS.includes(filter.field) ? new Date(filter.value) : filter.value };
        break;
      case "lte":
        where[filter.field] = { lte: DATE_FIELDS.includes(filter.field) ? new Date(filter.value) : filter.value };
        break;
    }
  }
  return where;
}

function getGroupByPrismaField(entity: Entity, groupBy: string): string {
  const map: Record<string, Record<string, string>> = {
    tickets: {
      assignedTo: "assignedToId",
      createdBy: "createdById",
      property: "propertyId",
      unit: "unitId",
      category: "categoryId",
      status: "status",
      priority: "priority",
      department: "departmentId",
    },
    assets: {
      property: "propertyId",
      category: "categoryId",
      condition: "condition",
      floor: "floorId",
    },
    properties: {
      city: "city",
      areaGroup: "areaGroupId",
      status: "status",
      type: "type",
    },
    units: {
      property: "propertyId",
      floor: "floorId",
      type: "unitType",
      status: "status",
    },
    users: {
      department: "departmentId",
      role: "roleId",
      status: "status",
    },
  };
  return map[entity]?.[groupBy] ?? groupBy;
}

// ─── Label resolution ────────────────────────────────────

async function resolveLabels(
  entity: Entity,
  groupBy: string,
  groupKeys: (string | null)[]
): Promise<Map<string | null, string>> {
  const labelMap = new Map<string | null, string>();
  const enumFields: Record<string, string[]> = {
    tickets: ["status", "priority"],
    assets: ["condition"],
    properties: ["city", "status", "type"],
    units: ["type", "status"],
    users: ["status"],
  };

  if (enumFields[entity]?.includes(groupBy)) {
    for (const key of groupKeys) labelMap.set(key, key ?? "Unassigned");
    return labelMap;
  }

  const nonNullKeys = groupKeys.filter((k): k is string => k !== null);

  switch (groupBy) {
    case "assignedTo":
    case "createdBy": {
      const users = await prisma.user.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, fullName: true, username: true } });
      for (const u of users) labelMap.set(u.id, u.fullName || u.username);
      break;
    }
    case "property": {
      const props = await prisma.property.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, name: true } });
      for (const p of props) labelMap.set(p.id, p.name);
      break;
    }
    case "unit": {
      const units = await prisma.unit.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, name: true, code: true } });
      for (const u of units) labelMap.set(u.id, u.name);
      break;
    }
    case "category": {
      if (entity === "tickets") {
        const cats = await prisma.ticketCategory.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, name: true } });
        for (const c of cats) labelMap.set(c.id, c.name);
      } else {
        const cats = await prisma.assetCategory.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, name: true } });
        for (const c of cats) labelMap.set(c.id, c.name);
      }
      break;
    }
    case "department": {
      const depts = await prisma.department.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, name: true } });
      for (const d of depts) labelMap.set(d.id, d.name);
      break;
    }
    case "role": {
      const roles = await prisma.role.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, name: true } });
      for (const r of roles) labelMap.set(r.id, r.name);
      break;
    }
    case "areaGroup": {
      const groups = await prisma.areaGroup.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, groupName: true, city: true } });
      for (const ag of groups) labelMap.set(ag.id, `${ag.groupName} (${ag.city})`);
      break;
    }
    case "floor": {
      const floors = await prisma.floor.findMany({ where: { id: { in: nonNullKeys } }, select: { id: true, name: true } });
      for (const f of floors) labelMap.set(f.id, f.name);
      break;
    }
  }

  if (groupKeys.includes(null)) labelMap.set(null, "Unassigned");
  return labelMap;
}

// ─── Breakdown query (tickets only) ──────────────────────

async function queryBreakdown(prismaGroupByField: string, groupBy: string, where: any, sortOrder: SortOrder, limit: number) {
  const tomorrow = getTomorrow();

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      [prismaGroupByField]: true,
      status: true,
      dueDate: true,
    } as any,
  });

  const groups = new Map<string | null, { total: number; open: number; inProgress: number; completed: number; overdue: number }>();

  for (const ticket of tickets as any[]) {
    const key = ticket[prismaGroupByField] ?? null;
    if (!groups.has(key)) groups.set(key, { total: 0, open: 0, inProgress: 0, completed: 0, overdue: 0 });
    const g = groups.get(key)!;
    g.total++;
    if (ticket.status === "COMPLETED") {
      g.completed++;
    } else {
      if (ticket.status === "OPEN") g.open++;
      if (ticket.status === "IN_PROGRESS") g.inProgress++;
      if (ticket.status === "OVERDUE") g.overdue++;
    }
  }

  const sorted = Array.from(groups.entries())
    .sort((a, b) => sortOrder === "desc" ? b[1].total - a[1].total : a[1].total - b[1].total)
    .slice(0, limit);

  const groupKeys = sorted.map(([k]) => k);
  const labels = await resolveLabels("tickets", groupBy, groupKeys);

  return sorted.map(([key, counts]) => ({
    groupKey: key,
    label: labels.get(key) ?? "Unassigned",
    ...counts,
  }));
}

// ─── Overdue count query (tickets only) ──────────────────

async function queryOverdueCount(prismaGroupByField: string, groupBy: string, where: any, sortOrder: SortOrder, limit: number) {
  const tomorrow = getTomorrow();
  const overdueWhere = { ...where, status: "OVERDUE" as const };

  const grouped = await prisma.ticket.groupBy({
    by: [prismaGroupByField as any],
    where: overdueWhere,
    _count: { id: true },
    orderBy: { _count: { id: sortOrder } },
    take: limit,
  });

  const groupKeys = grouped.map((r: any) => r[prismaGroupByField] ?? null);
  const labels = await resolveLabels("tickets", groupBy, groupKeys);

  return grouped.map((row: any) => ({
    groupKey: row[prismaGroupByField] ?? null,
    label: labels.get(row[prismaGroupByField] ?? null) ?? "Unassigned",
    value: row._count.id,
  }));
}

// ─── Avg completion time (tickets only) ──────────────────

async function queryAvgCompletionTime(groupByField: string, groupBy: string, where: any, sortOrder: SortOrder, limit: number) {
  const tickets = await prisma.ticket.findMany({
    where: { ...where, status: "COMPLETED" },
    select: { [groupByField]: true, createdAt: true, updatedAt: true } as any,
  });

  const groups = new Map<string | null, { totalHours: number; count: number }>();
  for (const ticket of tickets as any[]) {
    const key = ticket[groupByField] ?? null;
    const hours = (new Date(ticket.updatedAt).getTime() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);
    const existing = groups.get(key) || { totalHours: 0, count: 0 };
    existing.totalHours += hours;
    existing.count += 1;
    groups.set(key, existing);
  }

  const sorted = Array.from(groups.entries())
    .map(([key, data]) => ({ groupKey: key, avgHours: Math.round((data.totalHours / data.count) * 100) / 100 }))
    .sort((a, b) => sortOrder === "desc" ? b.avgHours - a.avgHours : a.avgHours - b.avgHours)
    .slice(0, limit);

  const labels = await resolveLabels("tickets", groupBy, sorted.map((r) => r.groupKey));

  return sorted.map((row) => ({
    groupKey: row.groupKey,
    label: labels.get(row.groupKey) ?? "Unassigned",
    value: row.avgHours,
  }));
}

// ─── Completed late (tickets completed after due date) ───

async function queryCompletedLate(prismaGroupByField: string, groupBy: string, where: any, sortOrder: SortOrder, limit: number) {
  const tickets = await prisma.ticket.findMany({
    where: { ...where, status: "COMPLETED", completedAt: { not: null } },
    select: { id: true, [prismaGroupByField]: true, completedAt: true, dueDate: true } as any,
  });

  const lateTickets = (tickets as any[]).filter((t) => t.completedAt && t.completedAt > t.dueDate);
  if (lateTickets.length === 0) return [];

  // Fetch all resolved blocks for these tickets to compute days blocked
  const lateTicketIds = lateTickets.map((t: any) => t.id);
  const blocks = await prisma.ticketBlock.findMany({
    where: { ticketId: { in: lateTicketIds }, resolvedAt: { not: null } },
    select: { ticketId: true, createdAt: true, resolvedAt: true },
  });

  const blockDaysByTicket = new Map<string, number>();
  for (const b of blocks) {
    const days = Math.ceil((b.resolvedAt!.getTime() - b.createdAt.getTime()) / 86400000);
    blockDaysByTicket.set(b.ticketId, (blockDaysByTicket.get(b.ticketId) || 0) + days);
  }

  const groups = new Map<string | null, { count: number; totalDaysLate: number; totalDaysBlocked: number }>();
  for (const ticket of lateTickets) {
    const key = ticket[prismaGroupByField] ?? null;
    const daysLate = Math.ceil((ticket.completedAt.getTime() - ticket.dueDate.getTime()) / 86400000);
    const daysBlocked = blockDaysByTicket.get(ticket.id) || 0;
    const existing = groups.get(key) || { count: 0, totalDaysLate: 0, totalDaysBlocked: 0 };
    existing.count++;
    existing.totalDaysLate += daysLate;
    existing.totalDaysBlocked += daysBlocked;
    groups.set(key, existing);
  }

  const sorted = Array.from(groups.entries())
    .map(([key, g]) => ({
      key,
      count: g.count,
      avgDaysLate: Math.round((g.totalDaysLate / g.count) * 10) / 10,
      avgDaysBlocked: Math.round((g.totalDaysBlocked / g.count) * 10) / 10,
    }))
    .sort((a, b) => sortOrder === "desc" ? b.count - a.count : a.count - b.count)
    .slice(0, limit);

  const labels = await resolveLabels("tickets", groupBy, sorted.map((r) => r.key));

  return sorted.map((row) => ({
    groupKey: row.key,
    label: labels.get(row.key) ?? "Unassigned",
    value: row.count,
    avgDaysLate: row.avgDaysLate,
    avgDaysBlocked: row.avgDaysBlocked,
  }));
}

// ─── Assets grouped by floor ─────────────────────────────

async function queryAssetsGroupedByFloor(where: any, sortOrder: SortOrder, limit: number) {
  const floorGroups = await prisma.asset.groupBy({ by: ["floorId"], where, _count: { id: true } });
  const sorted = floorGroups
    .map((g) => [g.floorId, g._count.id] as [string, number])
    .sort((a, b) => sortOrder === "desc" ? b[1] - a[1] : a[1] - b[1])
    .slice(0, limit);
  const labels = await resolveLabels("assets", "floor", sorted.map(([k]) => k));
  return sorted.map(([key, count]) => ({ groupKey: key, label: labels.get(key) ?? "Unassigned", value: count }));
}

// ─── Trend query ─────────────────────────────────────────

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function generatePeriods(start: Date, end: Date, granularity: Granularity) {
  const periods: { key: string; label: string; periodStart: Date; periodEnd: Date }[] = [];
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);

  while (current <= end) {
    let key: string;
    let label: string;
    let periodStart = new Date(current);
    let periodEnd: Date;

    if (granularity === "monthly") {
      key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      label = current.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    } else if (granularity === "weekly") {
      const wk = getWeekNumber(current);
      key = `${current.getFullYear()}-W${String(wk).padStart(2, "0")}`;
      label = `Wk ${wk} ${current.getFullYear()}`;
      periodEnd = new Date(current);
      periodEnd.setDate(periodEnd.getDate() + 7);
      current = new Date(periodEnd);
    } else {
      key = current.toISOString().split("T")[0];
      label = current.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      periodEnd = new Date(current);
      periodEnd.setDate(periodEnd.getDate() + 1);
      current = new Date(periodEnd);
    }

    periods.push({ key, label, periodStart, periodEnd });
    if (periods.length > 366) break; // safety limit
  }

  return periods;
}

async function queryTrend(entity: Entity, where: any, granularity: Granularity, start: Date, end: Date) {
  const periods = generatePeriods(start, end, granularity);
  const tomorrow = getTomorrow();

  if (entity === "tickets") {
    const tickets = await prisma.ticket.findMany({
      where: { ...where, createdAt: { gte: start, lte: end } },
      select: { createdAt: true, status: true, dueDate: true },
    });

    return periods.map(({ key, label, periodStart, periodEnd }) => {
      const pt = tickets.filter((t) => t.createdAt >= periodStart && t.createdAt < periodEnd);
      return {
        period: key,
        label,
        total: pt.length,
        completed: pt.filter((t) => t.status === "COMPLETED").length,
        open: pt.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length,
        overdue: pt.filter((t) => t.status !== "COMPLETED" && t.dueDate < tomorrow).length,
      };
    });
  }

  if (entity === "users") {
    const users = await prisma.user.findMany({
      where: { ...where, createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    });

    return periods.map(({ key, label, periodStart, periodEnd }) => ({
      period: key,
      label,
      value: users.filter((u) => u.createdAt >= periodStart && u.createdAt < periodEnd).length,
    }));
  }

  return [];
}

// ─── Users count query ───────────────────────────────────

async function queryUsers(groupBy: string, where: any, sortOrder: SortOrder, limit: number) {
  if (groupBy === "createdMonth") {
    const users = await prisma.user.findMany({ where, select: { createdAt: true } });
    const groups = new Map<string, number>();
    for (const u of users) {
      const key = `${u.createdAt.getFullYear()}-${String(u.createdAt.getMonth() + 1).padStart(2, "0")}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    const sorted = Array.from(groups.entries())
      .sort((a, b) => sortOrder === "desc" ? b[1] - a[1] : a[1] - b[1])
      .slice(0, limit);
    return sorted.map(([key, count]) => {
      const [year, month] = key.split("-").map(Number);
      const label = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      return { groupKey: key, label, value: count };
    });
  }

  const prismaField = getGroupByPrismaField("users", groupBy);
  const grouped = await prisma.user.groupBy({
    by: [prismaField as any],
    where,
    _count: { id: true },
    orderBy: { _count: { id: sortOrder } },
    take: limit,
  });

  const groupKeys = grouped.map((r: any) => r[prismaField] ?? null);
  const labels = await resolveLabels("users", groupBy, groupKeys);

  return grouped.map((row: any) => ({
    groupKey: row[prismaField] ?? null,
    label: labels.get(row[prismaField] ?? null) ?? "Unassigned",
    value: row._count.id,
  }));
}

// ─── Main query engine ───────────────────────────────────

export const reportService = {
  async runQuery(query: ReportQuery, userId: string, isSuperAdmin: boolean, allProperties: boolean) {
    const { entity, measure, groupBy, filters, sortOrder, limit: rawLimit, granularity, trendStart, trendEnd } = query;

    if (!GROUP_BY_ALLOWLIST[entity]) {
      throw { status: 400, message: `Invalid entity "${entity}"` };
    }

    if (measure !== "trend") {
      const allowlistError = validateAllowlist(entity, groupBy, filters, measure);
      if (allowlistError) throw { status: 400, message: allowlistError };
    }

    const limit = Math.min(Math.max(rawLimit || 50, 1), MAX_LIMIT);
    const where = buildPrismaWhere(filters);

    // Property scoping
    if (!isSuperAdmin && !allProperties && entity !== "users") {
      const propertyIds = await rbacService.getUserPropertyIds(userId);
      if (propertyIds !== "all") {
        if (entity === "properties") {
          where.id = { in: propertyIds };
        } else if (["tickets", "assets", "units"].includes(entity)) {
          if (where.propertyId) {
            const requested = typeof where.propertyId === "string" ? [where.propertyId] : (where.propertyId.in || [where.propertyId]);
            const allowed = requested.filter((id: string) => (propertyIds as string[]).includes(id));
            if (allowed.length === 0) return { data: [], type: "standard" };
            where.propertyId = allowed.length === 1 ? allowed[0] : { in: allowed };
          } else {
            where.propertyId = { in: propertyIds };
          }
        }
      }
    }

    // ── Trend ──
    if (measure === "trend") {
      if (!trendStart || !trendEnd) throw { status: 400, message: "trendStart and trendEnd are required for trend measure" };
      const start = new Date(trendStart);
      const end = new Date(trendEnd);
      end.setHours(23, 59, 59, 999);
      const data = await queryTrend(entity, where, granularity || "monthly", start, end);
      return { data, type: "trend" };
    }

    // ── Users entity ──
    if (entity === "users") {
      const data = await queryUsers(groupBy, where, sortOrder, limit);
      return { data, type: "standard" };
    }

    // ── Special: assets by floor ──
    if (entity === "assets" && groupBy === "floor") {
      const data = await queryAssetsGroupedByFloor(where, sortOrder, limit);
      return { data, type: "standard" };
    }

    const prismaGroupByField = getGroupByPrismaField(entity, groupBy);

    // ── Breakdown ──
    if (measure === "breakdown") {
      if (entity !== "tickets") throw { status: 400, message: "Breakdown is only available for tickets" };
      const data = await queryBreakdown(prismaGroupByField, groupBy, where, sortOrder, limit);
      return { data, type: "breakdown" };
    }

    // ── Overdue count ──
    if (measure === "overdue_count") {
      if (entity !== "tickets") throw { status: 400, message: "Overdue count is only available for tickets" };
      const data = await queryOverdueCount(prismaGroupByField, groupBy, where, sortOrder, limit);
      return { data, type: "standard" };
    }

    // ── Completed late ──
    if (measure === "completed_late") {
      if (entity !== "tickets") throw { status: 400, message: "Completed late is only available for tickets" };
      const data = await queryCompletedLate(prismaGroupByField, groupBy, where, sortOrder, limit);
      return { data, type: "standard" };
    }

    // ── Avg completion time ──
    if (measure === "avg_completion_time") {
      if (entity !== "tickets") throw { status: 400, message: "avg_completion_time is only available for tickets" };
      const data = await queryAvgCompletionTime(prismaGroupByField, groupBy, where, sortOrder, limit);
      return { data, type: "standard" };
    }

    // ── Standard count ──
    const modelMap: Record<string, any> = {
      tickets: prisma.ticket,
      assets: prisma.asset,
      properties: prisma.property,
      units: prisma.unit,
    };

    const grouped = await modelMap[entity].groupBy({
      by: [prismaGroupByField],
      where,
      _count: { id: true },
      orderBy: { _count: { id: sortOrder } },
      take: limit,
    });

    if (grouped.length === 0) return { data: [], type: "standard" };

    const groupKeys = grouped.map((r: any) => r[prismaGroupByField] ?? null);
    const labels = await resolveLabels(entity, groupBy, groupKeys);

    const data = grouped.map((row: any) => ({
      groupKey: row[prismaGroupByField] ?? null,
      label: labels.get(row[prismaGroupByField] ?? null) ?? "Unassigned",
      value: row._count.id,
    }));

    return { data, type: "standard" };
  },
};

// ─── Entity Report Types ─────────────────────────────────────────────────

export interface ReportTicketRow {
  id: string;
  ticketNumber: string;
  name: string;
  status: string;
  priority: string;
  taskType: string;
  subTaskType: string;
  isBlocked: boolean;
  property: { id: string; name: string };
  unit: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  assignedTo: { id: string; fullName: string | null; username: string } | null;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
}

export interface EntityReportResponse {
  entityType: "user" | "department" | "property" | "asset";
  meta: Record<string, any>;
  tickets: ReportTicketRow[];
}

// ─── Shared helpers ──────────────────────────────────────────────────────

const TICKET_REPORT_INCLUDE = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, fullName: true, username: true } },
  blocks: { select: { resolvedAt: true, blockingUserId: true, departmentId: true } },
} as const;

function mapTicketRow(t: any): ReportTicketRow {
  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    name: t.name,
    status: t.status,
    priority: t.priority,
    taskType: t.taskType,
    subTaskType: t.subTaskType,
    isBlocked: t.blocks.some((b: any) => !b.resolvedAt),
    property: t.property,
    unit: t.unit ?? null,
    category: t.category ?? null,
    assignedTo: t.assignedTo ?? null,
    dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString() : t.dueDate,
    completedAt: t.completedAt ? (t.completedAt instanceof Date ? t.completedAt.toISOString() : t.completedAt) : null,
    createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
  };
}

async function getPropertyScope(userId: string, isSuperAdmin: boolean, allProperties: boolean): Promise<Record<string, any>> {
  if (isSuperAdmin || allProperties) return {};
  const ids = await rbacService.getUserPropertyIds(userId);
  if (ids === "all") return {};
  return { propertyId: { in: ids as string[] } };
}

// ─── Entity report service ────────────────────────────────────────────────

export const entityReportService = {
  async getUser(targetUserId: string, requestingUserId: string, isSuperAdmin: boolean, allProperties: boolean): Promise<EntityReportResponse> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: targetUserId },
      select: {
        id: true, fullName: true, username: true, status: true,
        role: { select: { name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    const scopeFilter = await getPropertyScope(requestingUserId, isSuperAdmin, allProperties);

    const tickets = await prisma.ticket.findMany({
      where: {
        ...scopeFilter,
        OR: [{ assignedToId: targetUserId }, { createdById: targetUserId }],
      },
      include: TICKET_REPORT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    const wasBlockerCount = await prisma.ticketBlock.count({
      where: { blockingUserId: targetUserId },
    });

    return {
      entityType: "user",
      meta: { ...user, wasBlockerCount },
      tickets: tickets.map(mapTicketRow),
    };
  },

  async getDepartment(departmentId: string, requestingUserId: string, isSuperAdmin: boolean, allProperties: boolean): Promise<EntityReportResponse> {
    const dept = await prisma.department.findUniqueOrThrow({
      where: { id: departmentId },
      select: {
        id: true, name: true,
        _count: { select: { users: true } },
      },
    });

    const scopeFilter = await getPropertyScope(requestingUserId, isSuperAdmin, allProperties);

    const tickets = await prisma.ticket.findMany({
      where: { departmentId, ...scopeFilter },
      include: TICKET_REPORT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    const wasBlockerCount = await prisma.ticketBlock.count({
      where: { departmentId },
    });

    return {
      entityType: "department",
      meta: { id: dept.id, name: dept.name, memberCount: dept._count.users, wasBlockerCount },
      tickets: tickets.map(mapTicketRow),
    };
  },

  async getProperty(propertyId: string, requestingUserId: string, isSuperAdmin: boolean, allProperties: boolean): Promise<EntityReportResponse> {
    const hasAccess = isSuperAdmin || allProperties || await rbacService.userHasPropertyAccess(requestingUserId, propertyId);
    if (!hasAccess) throw { status: 403, message: "Access denied to this property" };

    const property = await prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: {
        id: true, name: true, code: true, type: true, city: true,
        _count: { select: { floors: true, units: true, assets: true } },
      },
    });

    const tickets = await prisma.ticket.findMany({
      where: { propertyId },
      include: TICKET_REPORT_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return {
      entityType: "property",
      meta: {
        id: property.id, name: property.name, code: property.code,
        type: property.type, city: property.city,
        floorCount: property._count.floors,
        unitCount: property._count.units,
        assetCount: property._count.assets,
        wasBlockerCount: 0,
      },
      tickets: tickets.map(mapTicketRow),
    };
  },

  async getAsset(assetId: string, requestingUserId: string, isSuperAdmin: boolean, allProperties: boolean): Promise<EntityReportResponse> {
    const asset = await prisma.asset.findUniqueOrThrow({
      where: { id: assetId },
      select: {
        id: true, name: true, code: true, serialNumber: true, condition: true,
        propertyId: true,
        category: { select: { name: true } },
        property: { select: { id: true, name: true } },
      },
    });

    const hasAccess = isSuperAdmin || allProperties || await rbacService.userHasPropertyAccess(requestingUserId, asset.propertyId);
    if (!hasAccess) throw { status: 403, message: "Access denied to this asset" };

    const links = await prisma.ticketAsset.findMany({
      where: { assetId },
      select: { ticketId: true },
    });

    const ticketIds = links.map((l: any) => l.ticketId);

    const tickets = ticketIds.length > 0
      ? await prisma.ticket.findMany({
          where: { id: { in: ticketIds } },
          include: TICKET_REPORT_INCLUDE,
          orderBy: { createdAt: "desc" },
        })
      : [];

    return {
      entityType: "asset",
      meta: {
        id: asset.id, name: asset.name, code: asset.code,
        serialNumber: asset.serialNumber ?? null,
        condition: asset.condition,
        category: asset.category,
        property: asset.property,
        wasBlockerCount: 0,
      },
      tickets: tickets.map(mapTicketRow),
    };
  },
};
