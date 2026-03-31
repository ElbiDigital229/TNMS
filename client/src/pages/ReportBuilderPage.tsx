import { useState, useEffect, useCallback } from "react";
import {
  reportApi,
  propertyApi,
  userApi,
  assetCategoryApi,
  ticketCategoryApi,
  departmentApi,
} from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { BarChart3, Plus, X, Download, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────
type Entity = "tickets" | "assets" | "properties" | "units" | "users";
type Measure = "count" | "avg_completion_time" | "breakdown" | "overdue_count" | "completed_late" | "trend";
type Operator = "eq" | "in" | "between" | "gte" | "lte";
type Granularity = "daily" | "weekly" | "monthly";
type DatePreset = "this_week" | "this_month" | "this_year" | "custom";
type ChartType = "bar" | "pie" | "line" | "grouped_bar";

interface ReportFilter {
  id: number;
  field: string;
  operator: Operator;
  value: any;
}

interface StandardRow { groupKey: string | null; label: string; value: number; }
interface BreakdownRow { groupKey: string | null; label: string; total: number; open: number; inProgress: number; completed: number; overdue: number; }
interface TrendRow { period: string; label: string; total?: number; open?: number; completed?: number; overdue?: number; value?: number; }

type ResultRow = StandardRow | BreakdownRow | TrendRow;

// ─── Config ──────────────────────────────────────────────

const ENTITY_LABELS: Record<Entity, string> = {
  tickets: "Tickets", assets: "Assets", properties: "Properties", units: "Units", users: "Users",
};

const MEASURE_OPTIONS: Record<Entity, { value: Measure; label: string }[]> = {
  tickets: [
    { value: "count", label: "Count" },
    { value: "breakdown", label: "Breakdown (Total / Open / Completed / Overdue)" },
    { value: "overdue_count", label: "Overdue Count" },
    { value: "avg_completion_time", label: "Avg Completion Time (hours)" },
    { value: "completed_late", label: "Completed Late (past due date)" },
    { value: "trend", label: "Trend Over Time" },
  ],
  assets: [{ value: "count", label: "Count" }],
  properties: [{ value: "count", label: "Count" }],
  units: [{ value: "count", label: "Count" }],
  users: [
    { value: "count", label: "Count" },
    { value: "trend", label: "Trend Over Time" },
  ],
};

const GROUP_BY_OPTIONS: Record<Entity, { value: string; label: string }[]> = {
  tickets: [
    { value: "department", label: "Department" },
    { value: "assignedTo", label: "Assigned To" },
    { value: "createdBy", label: "Created By" },
    { value: "property", label: "Property" },
    { value: "unit", label: "Unit" },
    { value: "category", label: "Category" },
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
  ],
  assets: [
    { value: "property", label: "Property" },
    { value: "category", label: "Category" },
    { value: "condition", label: "Condition" },
    { value: "floor", label: "Floor" },
  ],
  properties: [
    { value: "city", label: "City" },
    { value: "areaGroup", label: "Area Group" },
    { value: "status", label: "Status" },
    { value: "type", label: "Type" },
  ],
  units: [
    { value: "property", label: "Property" },
    { value: "floor", label: "Floor" },
    { value: "type", label: "Type" },
    { value: "status", label: "Status" },
  ],
  users: [
    { value: "department", label: "Department" },
    { value: "role", label: "Role" },
    { value: "status", label: "Status" },
    { value: "createdMonth", label: "Month Created" },
  ],
};

const FILTER_FIELD_OPTIONS: Record<Entity, { value: string; label: string }[]> = {
  tickets: [
    { value: "departmentId", label: "Department" },
    { value: "propertyId", label: "Property" },
    { value: "assignedToId", label: "Assigned To" },
    { value: "createdById", label: "Created By" },
    { value: "categoryId", label: "Category" },
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
    { value: "createdAt", label: "Created Date" },
    { value: "dueDate", label: "Due Date" },
  ],
  assets: [
    { value: "propertyId", label: "Property" },
    { value: "categoryId", label: "Category" },
    { value: "status", label: "Status" },
    { value: "condition", label: "Condition" },
    { value: "purchaseDate", label: "Purchase Date" },
  ],
  properties: [
    { value: "city", label: "City" },
    { value: "areaGroupId", label: "Area Group" },
    { value: "status", label: "Status" },
    { value: "type", label: "Type" },
  ],
  units: [
    { value: "propertyId", label: "Property" },
    { value: "floorId", label: "Floor" },
    { value: "status", label: "Status" },
    { value: "type", label: "Type" },
  ],
  users: [
    { value: "departmentId", label: "Department" },
    { value: "roleId", label: "Role" },
    { value: "status", label: "Status" },
    { value: "createdAt", label: "Created Date" },
  ],
};

const ENUM_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "tickets.status": [{ value: "OPEN", label: "Open" }, { value: "IN_PROGRESS", label: "In Progress" }, { value: "BLOCKED", label: "Blocked" }, { value: "COMPLETED", label: "Completed" }],
  "tickets.priority": [{ value: "CRITICAL", label: "Critical" }, { value: "HIGH", label: "High" }, { value: "MEDIUM", label: "Medium" }, { value: "LOW", label: "Low" }],
  "assets.status": [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
  "assets.condition": [{ value: "EXCELLENT", label: "Excellent" }, { value: "GOOD", label: "Good" }, { value: "FAIR", label: "Fair" }, { value: "POOR", label: "Poor" }],
  "properties.city": [{ value: "LAHORE", label: "Lahore" }, { value: "ISLAMABAD", label: "Islamabad" }],
  "properties.status": [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
  "properties.type": [{ value: "FLOOR", label: "Floor" }, { value: "BUILDING", label: "Building" }, { value: "COMPOUND", label: "Compound" }],
  "units.status": [{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }],
  "units.type": [{ value: "APARTMENT", label: "Apartment" }, { value: "OFFICE", label: "Office" }, { value: "SHOP", label: "Shop" }, { value: "WAREHOUSE", label: "Warehouse" }, { value: "OTHER", label: "Other" }],
  "users.status": [{ value: "ACTIVE", label: "Active" }, { value: "BLOCKED", label: "Blocked" }, { value: "INACTIVE", label: "Inactive" }],
};

const DATE_FIELDS = ["createdAt", "purchaseDate", "dueDate"];
const API_FIELDS = ["propertyId", "assignedToId", "createdById", "categoryId", "unitId", "floorId", "areaGroupId", "departmentId", "roleId"];

const BREAKDOWN_COLORS = {
  total: { bg: "bg-gray-500", text: "text-gray-700", label: "Total" },
  open: { bg: "bg-blue-500", text: "text-blue-700", label: "Open" },
  inProgress: { bg: "bg-amber-500", text: "text-amber-700", label: "In Progress" },
  completed: { bg: "bg-green-500", text: "text-green-700", label: "Completed" },
  overdue: { bg: "bg-red-500", text: "text-red-700", label: "Overdue" },
};

const TREND_COLORS = {
  total: { stroke: "#6b7280", label: "Total" },
  open: { stroke: "#3b82f6", label: "Open" },
  completed: { stroke: "#22c55e", label: "Completed" },
  overdue: { stroke: "#ef4444", label: "Overdue" },
  value: { stroke: "#8b5cf6", label: "Count" },
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

// ─── Chart type auto-select ───────────────────────────────

const ENUM_GROUP_BYS = ["status", "priority", "condition", "city", "type", "createdMonth"];

function getChartType(measure: Measure, groupBy: string): ChartType {
  if (measure === "trend") return "line";
  if (measure === "breakdown") return "grouped_bar";
  if (ENUM_GROUP_BYS.includes(groupBy)) return "pie";
  return "bar";
}

// ─── Date presets ─────────────────────────────────────────

function getPresetDates(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  if (preset === "this_week") {
    const day = now.getDay();
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun) };
  }
  if (preset === "this_month") {
    return { start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), end: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (preset === "this_year") {
    return { start: fmt(new Date(now.getFullYear(), 0, 1)), end: fmt(new Date(now.getFullYear(), 11, 31)) };
  }
  return { start: "", end: "" };
}

// ─── Helpers ─────────────────────────────────────────────

let filterIdCounter = 0;

function isEnumField(entity: Entity, field: string) { return !!ENUM_OPTIONS[`${entity}.${field}`]; }
function isDateField(field: string) { return DATE_FIELDS.includes(field); }
function isApiField(field: string) { return API_FIELDS.includes(field); }

function getOperatorsForField(entity: Entity, field: string): { value: Operator; label: string }[] {
  if (isDateField(field)) return [{ value: "between", label: "between" }, { value: "gte", label: ">=" }, { value: "lte", label: "<=" }];
  if (isEnumField(entity, field) || isApiField(field)) return [{ value: "eq", label: "=" }, { value: "in", label: "in" }];
  return [{ value: "eq", label: "=" }, { value: "in", label: "in" }, { value: "between", label: "between" }, { value: "gte", label: ">=" }, { value: "lte", label: "<=" }];
}

function exportCsv(results: ResultRow[], measure: Measure, resultType: string) {
  let csv = "";
  const bom = "\uFEFF";

  if (resultType === "breakdown") {
    csv = "Group,Total,Open,In Progress,Completed,Overdue\n";
    csv += (results as BreakdownRow[]).map((r) => `"${r.label.replace(/"/g, '""')}",${r.total},${r.open},${r.inProgress},${r.completed},${r.overdue}`).join("\n");
  } else if (resultType === "trend") {
    const rows = results as TrendRow[];
    const hasMulti = rows[0] && "total" in rows[0];
    if (hasMulti) {
      csv = "Period,Total,Open,Completed,Overdue\n";
      csv += rows.map((r) => `"${r.label}",${r.total ?? 0},${r.open ?? 0},${r.completed ?? 0},${r.overdue ?? 0}`).join("\n");
    } else {
      csv = "Period,Count\n";
      csv += rows.map((r) => `"${r.label}",${r.value ?? 0}`).join("\n");
    }
  } else {
    if (measure === "completed_late") {
      csv = "Group,Late Tickets,Avg Days Late,Avg Days Blocked\n";
      csv += (results as any[]).map((r) => `"${r.label.replace(/"/g, '""')}",${r.value},${r.avgDaysLate ?? ""},${r.avgDaysBlocked ?? ""}`).join("\n");
    } else {
      const measureLabel = measure === "avg_completion_time" ? "Avg Completion Time (hours)" : measure === "overdue_count" ? "Overdue Count" : "Count";
      csv = `Group,${measureLabel}\n`;
      csv += (results as StandardRow[]).map((r) => `"${r.label.replace(/"/g, '""')}",${r.value}`).join("\n");
    }
  }

  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── SVG Line Chart ───────────────────────────────────────

interface LineChartProps {
  data: TrendRow[];
  activeLines: Record<string, boolean>;
}

function LineChart({ data, activeLines }: LineChartProps) {
  if (data.length === 0) return null;

  const W = 600; const H = 240; const PAD = { top: 20, right: 20, bottom: 50, left: 40 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const hasMulti = "total" in data[0];
  const lineKeys = hasMulti ? ["total", "open", "completed", "overdue"] : ["value"];
  const activeKeys = lineKeys.filter((k) => activeLines[k] !== false);

  const allVals = data.flatMap((d) => activeKeys.map((k) => (d as any)[k] ?? 0));
  const maxVal = Math.max(...allVals, 1);

  const xStep = chartW / Math.max(data.length - 1, 1);

  const getPath = (key: string) => {
    return data.map((d, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + chartH - ((((d as any)[key] ?? 0) / maxVal) * chartH);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    }).join(" ");
  };

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxVal));

  // X-axis labels: show at most 8
  const xLabelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 260 }}>
      {/* Grid lines */}
      {yTicks.map((tick) => {
        const y = PAD.top + chartH - (tick / maxVal) * chartH;
        return (
          <g key={tick}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{tick}</text>
          </g>
        );
      })}

      {/* Lines */}
      {activeKeys.map((key) => (
        <path
          key={key}
          d={getPath(key)}
          fill="none"
          stroke={TREND_COLORS[key as keyof typeof TREND_COLORS]?.stroke ?? "#6b7280"}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* Dots */}
      {activeKeys.map((key) =>
        data.map((d, i) => {
          const x = PAD.left + i * xStep;
          const y = PAD.top + chartH - ((((d as any)[key] ?? 0) / maxVal) * chartH);
          return <circle key={`${key}-${i}`} cx={x} cy={y} r={3} fill={TREND_COLORS[key as keyof typeof TREND_COLORS]?.stroke ?? "#6b7280"} />;
        })
      )}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (i % xLabelStep !== 0 && i !== data.length - 1) return null;
        const x = PAD.left + i * xStep;
        return (
          <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af" transform={`rotate(-35, ${x}, ${H - 6})`}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── SVG Pie Chart ────────────────────────────────────────

function PieChart({ data }: { data: StandardRow[] }) {
  if (data.length === 0) return null;
  const total = data.reduce((s, r) => s + r.value, 0);
  if (total === 0) return null;

  const R = 80; const CX = 100; const CY = 100;
  let angle = -Math.PI / 2;

  const slices = data.map((row, i) => {
    const sweep = (row.value / total) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const largeArc = sweep > Math.PI ? 1 : 0;
    const path = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { path, color: PIE_COLORS[i % PIE_COLORS.length], label: row.label, value: row.value, pct: Math.round((row.value / total) * 100) };
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 200 200" className="w-48 flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={1.5} />
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-gray-700">{s.label}</span>
            <span className="font-semibold text-gray-900">{s.value.toLocaleString()}</span>
            <span className="text-gray-400">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Grouped Bar Chart (breakdown) ───────────────────────

function GroupedBarChart({ data }: { data: BreakdownRow[] }) {
  if (data.length === 0) return null;
  const maxVal = Math.max(...data.map((r) => r.total), 1);
  const keys: (keyof typeof BREAKDOWN_COLORS)[] = ["total", "open", "inProgress", "completed", "overdue"];

  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div key={row.groupKey ?? "null"}>
          <div className="mb-1 text-xs font-medium text-gray-700 truncate">{row.label}</div>
          <div className="space-y-0.5">
            {keys.map((key) => {
              const val = row[key] as number;
              const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
              const cfg = BREAKDOWN_COLORS[key];
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-20 text-right text-[11px] text-gray-500 flex-shrink-0">{cfg.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className={`h-3 rounded-full ${cfg.bg} transition-all duration-500`} style={{ width: `${pct}%`, minWidth: val > 0 ? 4 : 0 }} />
                  </div>
                  <span className="w-8 text-right text-[11px] font-medium text-gray-700 flex-shrink-0">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────

export default function ReportBuilderPage() {
  const toast = useToast();

  const [entity, setEntity] = useState<Entity>("tickets");
  const [measure, setMeasure] = useState<Measure>("count");
  const [groupBy, setGroupBy] = useState("department");
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  // Trend state
  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeLines, setActiveLines] = useState<Record<string, boolean>>({ total: true, open: true, completed: true, overdue: true, value: true });

  // Results
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [resultType, setResultType] = useState<string>("standard");
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Lookup data
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [assetCategories, setAssetCategories] = useState<{ id: string; name: string }[]>([]);
  const [ticketCategories, setTicketCategories] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    propertyApi.list({ limit: 500 }).then((res) => {
      const data = res.data.data?.data || res.data.data || [];
      setProperties(data.map((p: any) => ({ id: p.id, name: p.name })));
    }).catch(() => {});
    userApi.list({ limit: 500 }).then((res) => {
      const data = res.data.data?.data || res.data.data || [];
      setUsers(data.map((u: any) => ({ id: u.id, fullName: u.fullName || u.username })));
    }).catch(() => {});
    assetCategoryApi.list().then((res) => setAssetCategories((res.data.data || []).map((c: any) => ({ id: c.id, name: c.name })))).catch(() => {});
    ticketCategoryApi.list().then((res) => setTicketCategories((res.data.data || []).map((c: any) => ({ id: c.id, name: c.name })))).catch(() => {});
    departmentApi.list().then((res) => setDepartments((res.data.data || []).map((d: any) => ({ id: d.id, name: d.name })))).catch(() => {});
    // fetch roles from userApi list with a workaround - just extract unique roles from users
    import("../lib/api").then(({ roleApi }) => {
      roleApi.list({ activeOnly: "true" }).then((res) => setRoles((res.data.data || []).map((r: any) => ({ id: r.id, name: r.name })))).catch(() => {});
    });
  }, []);

  const handleEntityChange = useCallback((newEntity: Entity) => {
    setEntity(newEntity);
    setMeasure("count");
    setGroupBy(GROUP_BY_OPTIONS[newEntity][0]?.value || "");
    setFilters([]);
    setResults(null);
    setHasRun(false);
  }, []);

  const handleMeasureChange = (m: Measure) => {
    setMeasure(m);
    setResults(null);
    setHasRun(false);
  };

  const addFilter = () => {
    const fields = FILTER_FIELD_OPTIONS[entity];
    if (!fields.length) return;
    setFilters((prev) => [...prev, { id: ++filterIdCounter, field: fields[0].value, operator: "eq", value: "" }]);
  };

  const updateFilter = (id: number, updates: Partial<Omit<ReportFilter, "id">>) => {
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeFilter = (id: number) => setFilters((prev) => prev.filter((f) => f.id !== id));

  const handleFilterFieldChange = (id: number, newField: string) => {
    const operators = getOperatorsForField(entity, newField);
    updateFilter(id, { field: newField, operator: operators[0].value, value: isDateField(newField) ? ["", ""] : "" });
  };

  const handleFilterOperatorChange = (id: number, newOp: Operator) => {
    const filter = filters.find((f) => f.id === id);
    if (!filter) return;
    if (newOp === "between" && isDateField(filter.field)) updateFilter(id, { operator: newOp, value: ["", ""] });
    else if (newOp === "in") updateFilter(id, { operator: newOp, value: [] });
    else updateFilter(id, { operator: newOp, value: "" });
  };

  const getApiOptions = (field: string): { id: string; label: string }[] => {
    switch (field) {
      case "propertyId": return properties.map((p) => ({ id: p.id, label: p.name }));
      case "assignedToId": case "createdById": return users.map((u) => ({ id: u.id, label: u.fullName }));
      case "categoryId": return entity === "tickets" ? ticketCategories.map((c) => ({ id: c.id, label: c.name })) : assetCategories.map((c) => ({ id: c.id, label: c.name }));
      case "departmentId": return departments.map((d) => ({ id: d.id, label: d.name }));
      case "roleId": return roles.map((r) => ({ id: r.id, label: r.name }));
      default: return [];
    }
  };

  const getTrendDates = () => {
    if (datePreset === "custom") return { start: customStart, end: customEnd };
    return getPresetDates(datePreset);
  };

  const runReport = async () => {
    if (measure !== "trend" && !groupBy) { toast.error("Please select a Group By field"); return; }
    if (measure === "trend") {
      const { start, end } = getTrendDates();
      if (!start || !end) { toast.error("Please select a date range"); return; }
    }

    setLoading(true);
    setHasRun(true);
    try {
      const validFilters = filters.filter((f) => {
        if (f.operator === "between") return Array.isArray(f.value) && f.value[0] !== "" && f.value[1] !== "";
        if (f.operator === "in") return Array.isArray(f.value) && f.value.length > 0;
        return f.value !== "";
      }).map((f) => ({ field: f.field, operator: f.operator, value: f.value }));

      const payload: any = { entity, measure, groupBy, filters: validFilters, sortOrder: "desc", limit: 50 };

      if (measure === "trend") {
        const { start, end } = getTrendDates();
        payload.granularity = granularity;
        payload.trendStart = start;
        payload.trendEnd = end;
      }

      const res = await reportApi.runQuery(payload);
      const result = res.data.data;
      setResults(result.data || []);
      setResultType(result.type || "standard");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || "Failed to run report");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Chart type
  const chartType: ChartType = getChartType(measure, groupBy);

  // Summary stats
  const getSummary = () => {
    if (!results || results.length === 0) return null;
    if (resultType === "breakdown") {
      const rows = results as BreakdownRow[];
      return {
        total: rows.reduce((s, r) => s + r.total, 0),
        open: rows.reduce((s, r) => s + r.open, 0),
        inProgress: rows.reduce((s, r) => s + r.inProgress, 0),
        completed: rows.reduce((s, r) => s + r.completed, 0),
        overdue: rows.reduce((s, r) => s + r.overdue, 0),
      };
    }
    if (resultType === "standard") {
      const rows = results as StandardRow[];
      const total = rows.reduce((s, r) => s + r.value, 0);
      const avg = rows.length > 0 ? total / rows.length : 0;
      return { total, avg: Math.round(avg * 10) / 10, count: rows.length };
    }
    return null;
  };

  const summary = getSummary();
  const isTrend = resultType === "trend";
  const isBreakdown = resultType === "breakdown";
  const trendHasMulti = isTrend && results && results.length > 0 && "total" in results[0];

  const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Report Builder</h1>
        <p className="mt-1 text-[13px] text-gray-500">Build and run custom queries across your data</p>
      </div>

      {/* Query Builder */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Query Builder</h2>

        {/* Row 1: Entity + Measure */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Report On</label>
            <select value={entity} onChange={(e) => handleEntityChange(e.target.value as Entity)} className={`w-full ${inputCls}`}>
              {(Object.keys(ENTITY_LABELS) as Entity[]).map((e) => (
                <option key={e} value={e}>{ENTITY_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Measure</label>
            <select value={measure} onChange={(e) => handleMeasureChange(e.target.value as Measure)} className={`w-full ${inputCls}`}>
              {MEASURE_OPTIONS[entity].map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Trend Options */}
        {measure === "trend" ? (
          <div className="mb-4 rounded-lg bg-gray-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 mr-1">Granularity:</span>
              {(["daily", "weekly", "monthly"] as Granularity[]).map((g) => (
                <button key={g} onClick={() => setGranularity(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${granularity === g ? "bg-primary-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50"}`}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 mr-1">Date Range:</span>
              {(["this_week", "this_month", "this_year", "custom"] as DatePreset[]).map((p) => (
                <button key={p} onClick={() => setDatePreset(p)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${datePreset === p ? "bg-primary-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50"}`}>
                  {p === "this_week" ? "This Week" : p === "this_month" ? "This Month" : p === "this_year" ? "This Year" : "Custom"}
                </button>
              ))}
            </div>
            {datePreset === "custom" && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputCls} />
                <span className="text-xs text-gray-400">to</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>
        ) : (
          /* Group By */
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-500">Group By</label>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className={`w-full sm:w-64 ${inputCls}`}>
              <option value="">Select...</option>
              {GROUP_BY_OPTIONS[entity].map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500">Filters</label>
            <button onClick={addFilter} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50">
              <Plus size={14} /> Add Filter
            </button>
          </div>
          {filters.length === 0 && <p className="text-xs text-gray-400">No filters applied.</p>}
          <div className="space-y-2">
            {filters.map((filter) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                entity={entity}
                operators={getOperatorsForField(entity, filter.field)}
                apiOptions={getApiOptions(filter.field)}
                onFieldChange={(field) => handleFilterFieldChange(filter.id, field)}
                onOperatorChange={(op) => handleFilterOperatorChange(filter.id, op)}
                onValueChange={(value) => updateFilter(filter.id, { value })}
                onRemove={() => removeFilter(filter.id)}
              />
            ))}
          </div>
        </div>

        <button onClick={runReport} disabled={loading || (measure !== "trend" && !groupBy)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-all duration-200">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
          Run Report
        </button>
      </div>

      {/* Results */}
      {hasRun && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Results</h2>
            {results && results.length > 0 && (
              <button onClick={() => exportCsv(results, measure, resultType)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={32} className="animate-spin text-primary-400" /></div>
          ) : !results || results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <BarChart3 size={48} className="text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No data found.</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              {summary && (
                <div className="mb-5 grid gap-3 grid-cols-2 sm:grid-cols-4">
                  {isBreakdown ? (
                    Object.entries(BREAKDOWN_COLORS).map(([key, cfg]) => (
                      <div key={key} className="rounded-lg bg-gray-50 px-4 py-3 ring-1 ring-gray-200">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{cfg.label}</p>
                        <p className={`text-2xl font-bold ${cfg.text}`}>{(summary as any)[key]?.toLocaleString() ?? 0}</p>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="rounded-lg bg-gray-50 px-4 py-3 ring-1 ring-gray-200">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{measure === "avg_completion_time" ? "Total Hours" : "Grand Total"}</p>
                        <p className="text-2xl font-bold text-gray-900">{(summary as any).total?.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-4 py-3 ring-1 ring-gray-200">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Groups</p>
                        <p className="text-2xl font-bold text-gray-900">{(summary as any).count}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-4 py-3 ring-1 ring-gray-200">
                        <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Average</p>
                        <p className="text-2xl font-bold text-gray-900">{(summary as any).avg?.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Table */}
              <div className="mb-6 overflow-hidden rounded-lg ring-1 ring-gray-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Group</th>
                        {isBreakdown ? (
                          Object.values(BREAKDOWN_COLORS).map((cfg) => (
                            <th key={cfg.label} className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">{cfg.label}</th>
                          ))
                        ) : isTrend && trendHasMulti ? (
                          <>
                            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Total</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Open</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Completed</th>
                            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Overdue</th>
                          </>
                        ) : (
                          {measure === "completed_late" ? (
                            <>
                              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Late Tickets</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Avg Days Late</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Avg Days Blocked</th>
                            </>
                          ) : (
                            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                              {measure === "avg_completion_time" ? "Avg Hours" : measure === "overdue_count" ? "Overdue" : "Count"}
                            </th>
                          )}
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {isTrend ? (row as TrendRow).label : (row as StandardRow | BreakdownRow).label}
                          </td>
                          {isBreakdown ? (
                            Object.keys(BREAKDOWN_COLORS).map((key) => (
                              <td key={key} className="px-4 py-2.5 text-right tabular-nums text-gray-600">{((row as BreakdownRow)[key as keyof BreakdownRow] as number).toLocaleString()}</td>
                            ))
                          ) : isTrend && trendHasMulti ? (
                            <>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{((row as TrendRow).total ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{((row as TrendRow).open ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{((row as TrendRow).completed ?? 0).toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{((row as TrendRow).overdue ?? 0).toLocaleString()}</td>
                            </>
                          ) : measure === "completed_late" ? (
                            <>
                              <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">{(row as any).value.toLocaleString()}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-orange-600 font-medium">{(row as any).avgDaysLate?.toFixed(1) ?? "—"}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-blue-600">{(row as any).avgDaysBlocked > 0 ? (row as any).avgDaysBlocked.toFixed(1) : "—"}</td>
                            </>
                          ) : (
                            <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                              {isTrend ? ((row as TrendRow).value ?? 0).toLocaleString() : measure === "avg_completion_time" ? (row as StandardRow).value.toFixed(1) : (row as StandardRow).value.toLocaleString()}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chart */}
              <div>
                <h3 className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Chart</h3>

                {/* Trend line chart */}
                {chartType === "line" && (
                  <div>
                    {trendHasMulti && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {Object.entries(TREND_COLORS).filter(([k]) => k !== "value").map(([key, cfg]) => (
                          <button key={key} onClick={() => setActiveLines((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeLines[key] !== false ? "text-white" : "bg-white ring-1 ring-gray-300 text-gray-500"}`}
                            style={activeLines[key] !== false ? { background: cfg.stroke } : {}}>
                            <span className="h-2 w-2 rounded-full" style={{ background: cfg.stroke }} />
                            {cfg.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <LineChart data={results as TrendRow[]} activeLines={activeLines} />
                  </div>
                )}

                {/* Pie chart */}
                {chartType === "pie" && <PieChart data={results as StandardRow[]} />}

                {/* Grouped bar chart (breakdown) */}
                {chartType === "grouped_bar" && <GroupedBarChart data={results as BreakdownRow[]} />}

                {/* Standard horizontal bar chart */}
                {chartType === "bar" && (() => {
                  const rows = results as StandardRow[];
                  const maxVal = Math.max(...rows.map((r) => r.value), 1);
                  return (
                    <div className="space-y-2">
                      {rows.map((row, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-32 flex-shrink-0 truncate text-right text-xs text-gray-600">{row.label}</span>
                          <div className="flex-1">
                            <div className="h-6 rounded bg-primary-500 transition-all duration-500"
                              style={{ width: `${maxVal > 0 ? (row.value / maxVal) * 100 : 0}%`, minWidth: row.value > 0 ? 2 : 0 }} />
                          </div>
                          <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums font-medium text-gray-700">
                            {measure === "avg_completion_time" ? row.value.toFixed(1) : row.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter Row ───────────────────────────────────────────

interface FilterRowProps {
  filter: ReportFilter;
  entity: Entity;
  operators: { value: Operator; label: string }[];
  apiOptions: { id: string; label: string }[];
  onFieldChange: (field: string) => void;
  onOperatorChange: (op: Operator) => void;
  onValueChange: (value: any) => void;
  onRemove: () => void;
}

function FilterRow({ filter, entity, operators, apiOptions, onFieldChange, onOperatorChange, onValueChange, onRemove }: FilterRowProps) {
  const fields = FILTER_FIELD_OPTIONS[entity];
  const enumOpts = ENUM_OPTIONS[`${entity}.${filter.field}`];
  const isDate = isDateField(filter.field);
  const isApi = isApiField(filter.field);
  const isMulti = filter.operator === "in";
  const cls = "rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100";

  const renderValue = () => {
    if (isDate) {
      if (filter.operator === "between") {
        return (
          <div className="flex items-center gap-1.5">
            <input type="date" value={Array.isArray(filter.value) ? filter.value[0] || "" : ""} onChange={(e) => onValueChange([e.target.value, Array.isArray(filter.value) ? filter.value[1] || "" : ""])} className={`w-full ${cls}`} />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={Array.isArray(filter.value) ? filter.value[1] || "" : ""} onChange={(e) => onValueChange([Array.isArray(filter.value) ? filter.value[0] || "" : "", e.target.value])} className={`w-full ${cls}`} />
          </div>
        );
      }
      return <input type="date" value={filter.value || ""} onChange={(e) => onValueChange(e.target.value)} className={`w-full ${cls}`} />;
    }

    if (enumOpts) {
      if (isMulti) {
        const selected: string[] = Array.isArray(filter.value) ? filter.value : [];
        return (
          <div className="flex flex-wrap gap-1">
            {enumOpts.map((opt) => {
              const sel = selected.includes(opt.value);
              return (
                <button key={opt.value} type="button" onClick={() => onValueChange(sel ? selected.filter((v) => v !== opt.value) : [...selected, opt.value])}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${sel ? "bg-primary-100 text-primary-700 ring-1 ring-primary-300" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }
      return (
        <select value={filter.value || ""} onChange={(e) => onValueChange(e.target.value)} className={`w-full ${cls}`}>
          <option value="">Select...</option>
          {enumOpts.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      );
    }

    if (isApi && apiOptions.length > 0) {
      if (isMulti) {
        const selected: string[] = Array.isArray(filter.value) ? filter.value : [];
        return (
          <div>
            <select value="" onChange={(e) => { if (e.target.value && !selected.includes(e.target.value)) onValueChange([...selected, e.target.value]); }} className={`w-full ${cls}`}>
              <option value="">Add item...</option>
              {apiOptions.filter((o) => !selected.includes(o.id)).map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
            </select>
            {selected.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selected.map((id) => {
                  const opt = apiOptions.find((o) => o.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                      {opt?.label || id}
                      <button type="button" onClick={() => onValueChange(selected.filter((v) => v !== id))} className="text-primary-400 hover:text-primary-600"><X size={12} /></button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
      return (
        <select value={filter.value || ""} onChange={(e) => onValueChange(e.target.value)} className={`w-full ${cls}`}>
          <option value="">Select...</option>
          {apiOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
        </select>
      );
    }

    return <input type="text" value={filter.value || ""} onChange={(e) => onValueChange(e.target.value)} placeholder="Enter value..." className={`w-full ${cls}`} />;
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-start">
      <select value={filter.field} onChange={(e) => onFieldChange(e.target.value)} className={`sm:w-40 ${cls}`}>
        {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select value={filter.operator} onChange={(e) => onOperatorChange(e.target.value as Operator)} className={`sm:w-24 ${cls}`}>
        {operators.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      <div className="min-w-0 flex-1">{renderValue()}</div>
      <button onClick={onRemove} className="self-start rounded-md p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600"><X size={16} /></button>
    </div>
  );
}
