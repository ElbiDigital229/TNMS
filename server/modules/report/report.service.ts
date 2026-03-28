import { prisma } from "../../config/db.js";
import { rbacService } from "../../services/rbac.service.js";

// ─── Types ───────────────────────────────────────────────
type Entity = "tickets" | "assets" | "properties" | "units";
type Measure = "count" | "avg_completion_time";
type Operator = "eq" | "in" | "between" | "gte" | "lte";
type SortOrder = "asc" | "desc";

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
}

// ─── Allowlists ──────────────────────────────────────────
const GROUP_BY_ALLOWLIST: Record<Entity, string[]> = {
  tickets: ["assignedTo", "createdBy", "property", "unit", "category", "status", "priority"],
  assets: ["property", "category", "condition", "floor"],
  properties: ["city", "areaGroup", "status", "type"],
  units: ["property", "floor", "type", "status"],
};

const FILTER_FIELD_ALLOWLIST: Record<Entity, string[]> = {
  tickets: ["propertyId", "unitId", "assignedToId", "createdById", "categoryId", "status", "priority", "createdAt"],
  assets: ["propertyId", "categoryId", "status", "condition", "purchaseDate"],
  properties: ["city", "areaGroupId", "status", "type"],
  units: ["propertyId", "floorId", "status", "type"],
};

const DATE_FIELDS = ["createdAt", "purchaseDate"];
const MAX_LIMIT = 100;
const MAX_DATE_RANGE_MONTHS = 12;

// ─── Helpers ─────────────────────────────────────────────

function validateAllowlist(entity: Entity, groupBy: string, filters: ReportFilter[]): string | null {
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

function validateDateRange(filters: ReportFilter[]): string | null {
  for (const field of DATE_FIELDS) {
    const betweenFilter = filters.find((f) => f.field === field && f.operator === "between");
    if (betweenFilter) {
      const [start, end] = betweenFilter.value;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return `Invalid date values for "${field}" between filter`;
      }
      const diffMonths =
        (endDate.getFullYear() - startDate.getFullYear()) * 12 +
        (endDate.getMonth() - startDate.getMonth());
      if (diffMonths > MAX_DATE_RANGE_MONTHS) {
        return `Date range for "${field}" exceeds maximum of ${MAX_DATE_RANGE_MONTHS} months`;
      }
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
        where[filter.field] = {
          gte: DATE_FIELDS.includes(filter.field) ? new Date(filter.value) : filter.value,
        };
        break;
      case "lte":
        where[filter.field] = {
          lte: DATE_FIELDS.includes(filter.field) ? new Date(filter.value) : filter.value,
        };
        break;
    }
  }
  return where;
}

// Map groupBy field to the Prisma field used for grouping (the FK or enum field)
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
    },
    assets: {
      property: "propertyId",
      category: "categoryId",
      condition: "condition",
      floor: "unitId", // assets don't have floorId directly; we'll resolve via unit
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
  };
  return map[entity][groupBy];
}

// ─── Label resolution ────────────────────────────────────

async function resolveLabels(
  entity: Entity,
  groupBy: string,
  groupKeys: (string | null)[]
): Promise<Map<string | null, string>> {
  const labelMap = new Map<string | null, string>();

  // For enum fields, the key IS the label
  const enumFields: Record<string, string[]> = {
    tickets: ["status", "priority"],
    assets: ["condition"],
    properties: ["city", "status", "type"],
    units: ["type", "status"],
  };

  if (enumFields[entity]?.includes(groupBy)) {
    for (const key of groupKeys) {
      labelMap.set(key, key ?? "Unassigned");
    }
    return labelMap;
  }

  // For relation fields, look up names
  const nonNullKeys = groupKeys.filter((k): k is string => k !== null);
  if (nonNullKeys.length === 0) {
    labelMap.set(null, "Unassigned");
    return labelMap;
  }

  switch (groupBy) {
    case "assignedTo":
    case "createdBy": {
      const users = await prisma.user.findMany({
        where: { id: { in: nonNullKeys } },
        select: { id: true, fullName: true, username: true, status: true },
      });
      for (const user of users) {
        const name = user.fullName || user.username;
        const badge = user.status === "INACTIVE" ? " (Inactive)" : "";
        labelMap.set(user.id, `${name}${badge}`);
      }
      break;
    }
    case "property": {
      const properties = await prisma.property.findMany({
        where: { id: { in: nonNullKeys } },
        select: { id: true, name: true, code: true, status: true },
      });
      for (const prop of properties) {
        const badge = prop.status === "INACTIVE" ? " (Inactive)" : "";
        labelMap.set(prop.id, `${prop.name}${badge}`);
      }
      break;
    }
    case "unit": {
      const units = await prisma.unit.findMany({
        where: { id: { in: nonNullKeys } },
        select: { id: true, name: true, code: true, status: true },
      });
      for (const unit of units) {
        const badge = unit.status === "INACTIVE" ? " (Inactive)" : "";
        labelMap.set(unit.id, `${unit.name}${badge}`);
      }
      break;
    }
    case "category": {
      // Could be ticket category or asset category depending on entity
      if (entity === "tickets") {
        const cats = await prisma.ticketCategory.findMany({
          where: { id: { in: nonNullKeys } },
          select: { id: true, name: true, status: true },
        });
        for (const cat of cats) {
          const badge = cat.status === "INACTIVE" ? " (Inactive)" : "";
          labelMap.set(cat.id, `${cat.name}${badge}`);
        }
      } else if (entity === "assets") {
        const cats = await prisma.assetCategory.findMany({
          where: { id: { in: nonNullKeys } },
          select: { id: true, name: true, status: true },
        });
        for (const cat of cats) {
          const badge = cat.status === "INACTIVE" ? " (Inactive)" : "";
          labelMap.set(cat.id, `${cat.name}${badge}`);
        }
      }
      break;
    }
    case "areaGroup": {
      const groups = await prisma.areaGroup.findMany({
        where: { id: { in: nonNullKeys } },
        select: { id: true, groupName: true, city: true },
      });
      for (const ag of groups) {
        labelMap.set(ag.id, `${ag.groupName} (${ag.city})`);
      }
      break;
    }
    case "floor": {
      // For assets, groupBy "floor" is resolved via unit -> floor
      // For units, it's a direct floorId
      const floors = await prisma.floor.findMany({
        where: { id: { in: nonNullKeys } },
        select: { id: true, name: true, status: true },
      });
      for (const floor of floors) {
        const badge = floor.status === "INACTIVE" ? " (Inactive)" : "";
        labelMap.set(floor.id, `${floor.name}${badge}`);
      }
      break;
    }
  }

  // Set "Unassigned" for null keys
  if (groupKeys.includes(null)) {
    labelMap.set(null, "Unassigned");
  }

  return labelMap;
}

// ─── Special: assets groupBy floor ───────────────────────
// Assets don't have a direct floorId. We need to go through unit.floorId.
// For this case, we use a raw approach: group assets by unit, then map unit -> floor.

async function queryAssetsGroupedByFloor(where: any, sortOrder: SortOrder, limit: number) {
  // First group by unitId
  const unitGroups = await prisma.asset.groupBy({
    by: ["unitId"],
    where,
    _count: { id: true },
  });

  // Get unit -> floor mapping
  const unitIds = unitGroups.map((g) => g.unitId);
  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    select: { id: true, floorId: true },
  });
  const unitFloorMap = new Map(units.map((u) => [u.id, u.floorId]));

  // Aggregate by floor
  const floorCounts = new Map<string, number>();
  for (const group of unitGroups) {
    const floorId = unitFloorMap.get(group.unitId) || "unknown";
    floorCounts.set(floorId, (floorCounts.get(floorId) || 0) + group._count.id);
  }

  // Sort and limit
  const sorted = Array.from(floorCounts.entries()).sort((a, b) =>
    sortOrder === "desc" ? b[1] - a[1] : a[1] - b[1]
  );
  const limited = sorted.slice(0, limit);

  // Resolve labels
  const floorKeys = limited.map(([k]) => k === "unknown" ? null : k);
  const labels = await resolveLabels("assets", "floor", floorKeys);

  return limited.map(([key, count]) => ({
    groupKey: key === "unknown" ? null : key,
    label: labels.get(key === "unknown" ? null : key) || "Unassigned",
    value: count,
  }));
}

// ─── Avg completion time (tickets only) ──────────────────

async function queryTicketsAvgCompletionTime(
  groupByField: string,
  where: any,
  sortOrder: SortOrder,
  limit: number,
  groupBy: string
) {
  // Get completed tickets matching filters
  const completedWhere = { ...where, status: "COMPLETED" as const };

  const tickets = await prisma.ticket.findMany({
    where: completedWhere,
    select: {
      [groupByField]: true,
      createdAt: true,
      updatedAt: true,
    } as any,
  });

  // Group and calculate average completion time (in hours)
  const groups = new Map<string | null, { totalHours: number; count: number }>();
  for (const ticket of tickets) {
    const key = (ticket as any)[groupByField] ?? null;
    const hours =
      (new Date((ticket as any).updatedAt).getTime() - new Date((ticket as any).createdAt).getTime()) /
      (1000 * 60 * 60);
    const existing = groups.get(key) || { totalHours: 0, count: 0 };
    existing.totalHours += hours;
    existing.count += 1;
    groups.set(key, existing);
  }

  // Sort and limit
  const sorted = Array.from(groups.entries())
    .map(([key, data]) => ({
      groupKey: key,
      avgHours: Math.round((data.totalHours / data.count) * 100) / 100,
    }))
    .sort((a, b) => (sortOrder === "desc" ? b.avgHours - a.avgHours : a.avgHours - b.avgHours));
  const limited = sorted.slice(0, limit);

  // Resolve labels
  const groupKeys = limited.map((r) => r.groupKey);
  const labels = await resolveLabels("tickets", groupBy, groupKeys);

  return limited.map((row) => ({
    groupKey: row.groupKey,
    label: labels.get(row.groupKey) || "Unassigned",
    value: row.avgHours,
  }));
}

// ─── Main query engine ───────────────────────────────────

export const reportService = {
  async runQuery(query: ReportQuery, userId: string, isSuperAdmin: boolean, allProperties: boolean) {
    const { entity, measure, groupBy, filters, sortOrder, limit: rawLimit } = query;

    // Validate entity
    if (!GROUP_BY_ALLOWLIST[entity]) {
      throw { status: 400, message: `Invalid entity "${entity}"` };
    }

    // Validate measure
    if (measure === "avg_completion_time" && entity !== "tickets") {
      throw { status: 400, message: "avg_completion_time measure is only available for tickets" };
    }

    // Validate allowlists
    const allowlistError = validateAllowlist(entity, groupBy, filters);
    if (allowlistError) {
      throw { status: 400, message: allowlistError };
    }

    // Validate date ranges
    const dateError = validateDateRange(filters);
    if (dateError) {
      throw { status: 400, message: dateError };
    }

    // Cap limit
    const limit = Math.min(Math.max(rawLimit || 50, 1), MAX_LIMIT);

    // Build where clause from filters
    const where = buildPrismaWhere(filters);

    // Property scoping for non-super-admin users without allProperties
    if (!isSuperAdmin && !allProperties) {
      const propertyIds = await rbacService.getUserPropertyIds(userId);
      if (propertyIds !== "all") {
        if (entity === "properties") {
          // Scope to user's assigned properties
          where.id = where.id ? { in: propertyIds } : { in: propertyIds };
        } else if (entity === "tickets" || entity === "assets" || entity === "units") {
          // These entities have a propertyId field
          if (where.propertyId) {
            // If user already filtered by propertyId, intersect with allowed
            const requested = typeof where.propertyId === "string" ? [where.propertyId] : (where.propertyId.in || [where.propertyId]);
            const allowed = requested.filter((id: string) => propertyIds.includes(id));
            if (allowed.length === 0) {
              return { data: [], message: "No data found" };
            }
            where.propertyId = allowed.length === 1 ? allowed[0] : { in: allowed };
          } else {
            where.propertyId = { in: propertyIds };
          }
        }
      }
    }

    // Get the Prisma field for grouping
    const prismaGroupByField = getGroupByPrismaField(entity, groupBy);

    // Special case: assets grouped by floor (needs unit -> floor resolution)
    if (entity === "assets" && groupBy === "floor") {
      const data = await queryAssetsGroupedByFloor(where, sortOrder, limit);
      if (data.length === 0) {
        return { data: [], message: "No data found" };
      }
      return { data };
    }

    // Special case: avg_completion_time
    if (measure === "avg_completion_time") {
      const data = await queryTicketsAvgCompletionTime(prismaGroupByField, where, sortOrder, limit, groupBy);
      if (data.length === 0) {
        return { data: [], message: "No data found" };
      }
      return { data };
    }

    // Standard count groupBy query
    const modelMap: Record<Entity, any> = {
      tickets: prisma.ticket,
      assets: prisma.asset,
      properties: prisma.property,
      units: prisma.unit,
    };

    const model = modelMap[entity];

    const groupByResult = await model.groupBy({
      by: [prismaGroupByField],
      where,
      _count: { id: true },
      orderBy: { _count: { id: sortOrder } },
      take: limit,
    });

    if (groupByResult.length === 0) {
      return { data: [], message: "No data found" };
    }

    // Resolve labels
    const groupKeys = groupByResult.map((r: any) => r[prismaGroupByField] ?? null);
    const labels = await resolveLabels(entity, groupBy, groupKeys);

    const data = groupByResult.map((row: any) => {
      const key = row[prismaGroupByField] ?? null;
      return {
        groupKey: key,
        label: labels.get(key) || "Unassigned",
        value: row._count.id,
      };
    });

    return { data };
  },
};
