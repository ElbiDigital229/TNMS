import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { reportApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls, STATUS_COLOR, PRIORITY_COLOR } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import { StatusBadge, PriorityBadge, Badge } from "../components/ui/Badge";
import {
  ArrowLeft, Download, Users, Building2, LayoutGrid, Package,
  Clock, CheckCircle2, AlertCircle, Loader2, TrendingUp, ShieldAlert, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportTicketRow {
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
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ActiveFilters {
  dateFrom: string;
  dateTo: string;
  propertyId: string;
  categoryId: string;
  status: string[];
  subTaskType: string;
}

interface ChartFilter { type: string; label: string; value: string | null; }

interface BreakdownSlice { key: string | null; label: string; count: number; }
interface TimelinePoint { period: string; label: string; count: number; }

const EMPTY_FILTERS: ActiveFilters = {
  dateFrom: "", dateTo: "", propertyId: "", categoryId: "", status: [], subTaskType: "",
};

// ─── Colors / Labels ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  UNASSIGNED: "Unassigned", ASSIGNED: "Assigned", IN_PROGRESS: "In Progress", BLOCKED: "Blocked", COMPLETED: "Completed",
};

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6"];

const ENTITY_ICONS: Record<string, any> = {
  user: Users, department: LayoutGrid, property: Building2, asset: Package,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  return [...new Map(arr.map((x) => [x.id, x])).values()];
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── SVG Horizontal Bar Chart ─────────────────────────────────────────────────

function HBarChart({ data, onSegmentClick }: { data: BreakdownSlice[]; onSegmentClick?: (slice: BreakdownSlice) => void }) {
  if (data.length === 0) return <p className="text-[13px] text-gray-400 py-4 text-center">No data</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const clickable = !!onSegmentClick;
  return (
    <div className="space-y-2.5">
      {data.slice(0, 10).map((row, i) => (
        <div
          key={row.key ?? i}
          className={`flex items-center gap-2 group${clickable ? " cursor-pointer" : ""}`}
          onClick={clickable ? () => onSegmentClick(row) : undefined}
          title={clickable ? `Click to filter by ${row.label}` : undefined}
        >
          <span className="w-28 shrink-0 text-[11px] text-gray-600 truncate text-right" title={row.label}>{row.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500${clickable ? " group-hover:brightness-110" : ""}`}
              style={{ width: `${(row.count / max) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length], minWidth: row.count > 0 ? 6 : 0 }}
            />
          </div>
          <span className="w-7 shrink-0 text-right text-[11px] font-semibold text-gray-700">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({ data, onSegmentClick }: { data: BreakdownSlice[]; onSegmentClick?: (slice: BreakdownSlice) => void }) {
  if (data.length === 0) return <p className="text-[13px] text-gray-400 py-4 text-center">No data</p>;
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <p className="text-[13px] text-gray-400 py-4 text-center">No data</p>;

  const R = 70; const r = 42; const CX = 90; const CY = 90;
  let angle = -Math.PI / 2;
  const clickable = !!onSegmentClick;

  const slices = data.map((row, i) => {
    const sweep = (row.count / total) * 2 * Math.PI;
    const x1o = CX + R * Math.cos(angle); const y1o = CY + R * Math.sin(angle);
    const x1i = CX + r * Math.cos(angle); const y1i = CY + r * Math.sin(angle);
    angle += sweep;
    const x2o = CX + R * Math.cos(angle); const y2o = CY + R * Math.sin(angle);
    const x2i = CX + r * Math.cos(angle); const y2i = CY + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${R} ${R} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${r} ${r} 0 ${large} 0 ${x1i} ${y1i} Z`;
    return { path, color: CHART_COLORS[i % CHART_COLORS.length], label: row.label, count: row.count, pct: Math.round((row.count / total) * 100), key: row.key };
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg viewBox="0 0 180 180" className="w-36 shrink-0">
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            stroke="white"
            strokeWidth={1.5}
            className={clickable ? "cursor-pointer transition-opacity hover:opacity-75" : ""}
            onClick={clickable ? () => onSegmentClick({ key: s.key, label: s.label, count: s.count }) : undefined}
          >
            <title>{`${s.label}: ${s.count} (${s.pct}%)`}</title>
          </path>
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#111827">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize={9} fill="#9ca3af">total</text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {slices.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-1.5 text-[11px]${clickable ? " cursor-pointer hover:opacity-70 transition-opacity" : ""}`}
            onClick={clickable ? () => onSegmentClick({ key: s.key, label: s.label, count: s.count }) : undefined}
          >
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-700">{s.label}</span>
            <span className="font-semibold text-gray-900">{s.count}</span>
            <span className="text-gray-400">({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SVG Timeline Chart ───────────────────────────────────────────────────────

function TimelineChart({ data }: { data: TimelinePoint[] }) {
  if (data.length === 0) return null;
  const W = 560; const H = 200; const PAD = { top: 16, right: 16, bottom: 44, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const xStep = cW / Math.max(data.length - 1, 1);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxVal));
  const xLabelStep = Math.max(1, Math.ceil(data.length / 7));

  const path = data.map((d, i) => {
    const x = PAD.left + i * xStep;
    const y = PAD.top + cH - (d.count / maxVal) * cH;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
      {yTicks.map((tick) => {
        const y = PAD.top + cH - (tick / maxVal) * cH;
        return (
          <g key={tick}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{tick}</text>
          </g>
        );
      })}
      <path d={path} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => {
        const x = PAD.left + i * xStep;
        const y = PAD.top + cH - (d.count / maxVal) * cH;
        return <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" />;
      })}
      {data.map((d, i) => {
        if (i % xLabelStep !== 0 && i !== data.length - 1) return null;
        const x = PAD.left + i * xStep;
        return (
          <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af" transform={`rotate(-30, ${x}, ${H - 6})`}>
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Breakdown Card ───────────────────────────────────────────────────────────

function BreakdownCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
      <h3 className="text-[13px] font-semibold text-gray-800 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ─── Timeline helper ──────────────────────────────────────────────────────────

function computeTimeline(tickets: ReportTicketRow[]): TimelinePoint[] {
  const now = new Date();
  const months: TimelinePoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    months.push({ period: key, label, count: 0 });
  }
  for (const t of tickets) {
    const d = new Date(t.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const pt = months.find((m) => m.period === key);
    if (pt) pt.count++;
  }
  return months;
}

// ─── countBy helper ───────────────────────────────────────────────────────────

function countBy(tickets: ReportTicketRow[], keyFn: (t: ReportTicketRow) => string | null, labelFn: (key: string | null) => string): BreakdownSlice[] {
  const map = new Map<string | null, number>();
  for (const t of tickets) {
    const k = keyFn(t);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, label: labelFn(key), count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EntityReportPage() {
  const { entityType, entityId } = useParams<{ entityType: string; entityId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<any>(null);
  const [rawTickets, setRawTickets] = useState<ReportTicketRow[]>([]);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [tablePage, setTablePage] = useState(1);
  const [sortCol, setSortCol] = useState<"createdAt" | "dueDate" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [chartFilter, setChartFilter] = useState<ChartFilter | null>(null);

  const TABLE_PAGE_SIZE = 25;

  useEffect(() => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setError("");
    reportApi.getEntityReport(entityType, entityId)
      .then((res) => {
        const data = res.data.data;
        setMeta(data.meta);
        setRawTickets(data.tickets ?? []);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Failed to load report");
      })
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  // ── Filter options (stable, from raw) ──────────────────────────────────────
  const filterOptions = useMemo(() => ({
    properties: dedupeById(rawTickets.map((t) => t.property)),
    categories: dedupeById(rawTickets.filter((t) => t.category).map((t) => t.category!)),
  }), [rawTickets]);

  // ── Filtered tickets ───────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    let r = rawTickets;
    if (activeFilters.dateFrom) r = r.filter((t) => new Date(t.createdAt) >= new Date(activeFilters.dateFrom));
    if (activeFilters.dateTo) r = r.filter((t) => new Date(t.createdAt) <= endOfDay(activeFilters.dateTo));
    if (activeFilters.propertyId) r = r.filter((t) => t.property.id === activeFilters.propertyId);
    if (activeFilters.categoryId) r = r.filter((t) => t.category?.id === activeFilters.categoryId);
    if (activeFilters.status.length) r = r.filter((t) => activeFilters.status.includes(t.status));
    if (activeFilters.subTaskType) r = r.filter((t) => t.subTaskType === activeFilters.subTaskType);
    // Chart drill-down filter
    if (chartFilter) {
      switch (chartFilter.type) {
        case "status": r = r.filter((t) => t.status === chartFilter.value); break;
        case "property": r = r.filter((t) => t.property.id === chartFilter.value); break;
        case "category": r = r.filter((t) => (t.category?.id ?? null) === chartFilter.value); break;
        case "assignee": r = r.filter((t) => (t.assignedTo?.id ?? null) === chartFilter.value); break;
        case "unit": r = r.filter((t) => (t.unit?.id ?? null) === chartFilter.value); break;
        case "priority": r = r.filter((t) => t.priority === chartFilter.value); break;
      }
    }
    return r;
  }, [rawTickets, activeFilters, chartFilter]);

  // ── Summary ────────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const completed = filteredTickets.filter((t) => t.status === "COMPLETED");
    const onTime = completed.filter((t) => t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate));
    let totalMs = 0;
    for (const t of completed) {
      if (t.completedAt) totalMs += new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
    }
    const avgHours = completed.length ? Math.round(totalMs / completed.length / 3600000) : 0;
    const onTimePct = completed.length ? Math.round((onTime.length / completed.length) * 100) : 0;
    return {
      total: filteredTickets.length,
      completed: completed.length,
      inProgress: filteredTickets.filter((t) => t.status === "IN_PROGRESS").length,
      overdue: filteredTickets.filter((t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate) < new Date()).length,
      blocked: filteredTickets.filter((t) => t.isBlocked).length,
      avgHours,
      onTimePct,
      wasBlockerCount: meta?.wasBlockerCount ?? 0,
    };
  }, [filteredTickets, meta]);

  // ── Breakdowns ─────────────────────────────────────────────────────────────
  const breakdowns = useMemo(() => {
    const propMap = new Map(rawTickets.map((t) => [t.property.id, t.property.name]));
    const catMap = new Map(rawTickets.filter((t) => t.category).map((t) => [t.category!.id, t.category!.name]));
    const unitMap = new Map(rawTickets.filter((t) => t.unit).map((t) => [t.unit!.id, t.unit!.name]));

    return {
      byStatus: countBy(filteredTickets, (t) => t.status, (k) => STATUS_LABELS[k ?? ""] ?? k ?? "Unknown"),
      byProperty: countBy(filteredTickets, (t) => t.property.id, (k) => propMap.get(k ?? "") ?? "Unknown"),
      byCategory: countBy(filteredTickets, (t) => t.category?.id ?? null, (k) => catMap.get(k ?? "") ?? "Uncategorised"),
      byAssignee: countBy(filteredTickets, (t) => t.assignedTo?.id ?? null, (k) => {
        const found = rawTickets.find((t) => t.assignedTo?.id === k);
        return found?.assignedTo?.fullName ?? found?.assignedTo?.username ?? "Unassigned";
      }),
      byUnit: countBy(filteredTickets, (t) => t.unit?.id ?? null, (k) => unitMap.get(k ?? "") ?? "No Unit"),
      byPriority: countBy(filteredTickets, (t) => t.priority, (k) => k ?? "Unknown"),
      byTimeline: computeTimeline(filteredTickets),
    };
  }, [filteredTickets, rawTickets]);

  // ── Sorted + paginated table ───────────────────────────────────────────────
  const sortedTickets = useMemo(() => {
    const sorted = [...filteredTickets].sort((a, b) => {
      const va = new Date(a[sortCol] ?? "").getTime();
      const vb = new Date(b[sortCol] ?? "").getTime();
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return sorted;
  }, [filteredTickets, sortCol, sortDir]);

  const pagedTickets = sortedTickets.slice((tablePage - 1) * TABLE_PAGE_SIZE, tablePage * TABLE_PAGE_SIZE);
  const totalPages = Math.ceil(sortedTickets.length / TABLE_PAGE_SIZE);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  };

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const toggleStatus = (s: string) => {
    setActiveFilters((f) => ({
      ...f,
      status: f.status.includes(s) ? f.status.filter((x) => x !== s) : [...f.status, s],
    }));
    setTablePage(1);
  };
  const setFilter = (key: keyof ActiveFilters, val: any) => {
    setActiveFilters((f) => ({ ...f, [key]: val }));
    setTablePage(1);
  };
  const clearFilters = () => { setActiveFilters(EMPTY_FILTERS); setChartFilter(null); setTablePage(1); };
  const hasActiveFilters = Object.values(activeFilters).some((v) => (Array.isArray(v) ? v.length > 0 : v !== "")) || chartFilter !== null;

  const applyChartFilter = (type: string, slice: BreakdownSlice) => {
    setChartFilter({ type, label: slice.label, value: slice.key });
    setTablePage(1);
  };
  const clearChartFilter = () => { setChartFilter(null); setTablePage(1); };

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCsv = () => {
    const header = "Ticket#,Name,Status,Priority,Blocked,Property,Assignee,Due Date,Completed At,Created At\n";
    const rows = sortedTickets.map((t) =>
      [t.ticketNumber, `"${t.name.replace(/"/g, '""')}"`, t.status, t.priority,
       t.isBlocked ? "Yes" : "No", `"${t.property.name}"`,
       t.assignedTo ? (t.assignedTo.fullName ?? t.assignedTo.username) : "Unassigned",
       fmtDate(t.dueDate), fmtDate(t.completedAt), fmtDate(t.createdAt)].join(",")
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-${entityType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Render meta header ─────────────────────────────────────────────────────
  const EntityIcon = ENTITY_ICONS[entityType ?? ""] ?? LayoutGrid;

  const renderMetaHeader = () => {
    if (!meta) return null;
    if (entityType === "user") {
      return (
        <div>
          <p className="text-lg font-bold text-gray-900">{meta.fullName ?? meta.username}</p>
          <p className="text-[13px] text-gray-500 mt-0.5">{meta.role?.name} · {meta.department?.name} · <span className={meta.status === "ACTIVE" ? "text-green-600" : "text-gray-400"}>{meta.status}</span></p>
        </div>
      );
    }
    if (entityType === "department") {
      return (
        <div>
          <p className="text-lg font-bold text-gray-900">{meta.name}</p>
          <p className="text-[13px] text-gray-500 mt-0.5">{meta.memberCount} member{meta.memberCount !== 1 ? "s" : ""}</p>
        </div>
      );
    }
    if (entityType === "property") {
      return (
        <div>
          <p className="text-lg font-bold text-gray-900">{meta.name}</p>
          <p className="text-[13px] text-gray-500 mt-0.5">{meta.code} · {meta.city} · {meta.floorCount} floors · {meta.unitCount} units · {meta.assetCount} assets</p>
        </div>
      );
    }
    if (entityType === "asset") {
      return (
        <div>
          <p className="text-lg font-bold text-gray-900">{meta.name}</p>
          <p className="text-[13px] text-gray-500 mt-0.5">{meta.code} · {meta.category?.name} · {meta.condition} · {meta.property?.name}</p>
        </div>
      );
    }
    return null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <TableLoading />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <EmptyState
          icon={<AlertCircle size={40} />}
          title={error}
          subtitle="Could not load the report data."
        />
        <button onClick={() => navigate("/reports")} className={`mt-3 ${cls.btnGhost}`}>← Back to Reports</button>
      </div>
    );
  }

  const entityTypeLabel = entityType ? entityType.charAt(0).toUpperCase() + entityType.slice(1) : "Entity";

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate("/reports")} className={cls.btnIcon}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-gray-100 p-2">
              <EntityIcon size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">{entityTypeLabel} Report</p>
              {renderMetaHeader()}
            </div>
          </div>
        </div>
        <button onClick={exportCsv} className={cls.btnSecondary}>
          <Download size={13} />
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mb-3 rounded-lg bg-white p-3 ring-1 ring-gray-200">
        <div className="flex flex-wrap items-end gap-3">
          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={activeFilters.dateFrom}
              onChange={(e) => setFilter("dateFrom", e.target.value)}
              className={cls.input + " w-auto"}
            />
            <span className="text-[11px] text-gray-400">to</span>
            <input
              type="date"
              value={activeFilters.dateTo}
              onChange={(e) => setFilter("dateTo", e.target.value)}
              className={cls.input + " w-auto"}
            />
          </div>

          {/* Property (hidden for asset) */}
          {entityType !== "asset" && filterOptions.properties.length > 1 && (
            <select
              value={activeFilters.propertyId}
              onChange={(e) => setFilter("propertyId", e.target.value)}
              className={cls.select}
            >
              <option value="">All Properties</option>
              {filterOptions.properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Category */}
          {filterOptions.categories.length > 0 && (
            <select
              value={activeFilters.categoryId}
              onChange={(e) => setFilter("categoryId", e.target.value)}
              className={cls.select}
            >
              <option value="">All Categories</option>
              {filterOptions.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {/* Sub task type */}
          <select
            value={activeFilters.subTaskType}
            onChange={(e) => setFilter("subTaskType", e.target.value)}
            className={cls.select}
          >
            <option value="">All Types</option>
            <option value="REACTIVE">Reactive</option>
            <option value="PREVENTIVE">Preventive</option>
          </select>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {["UNASSIGNED", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "COMPLETED"].map((s) => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  activeFilters.status.includes(s) ? (STATUS_COLOR[s] ?? "bg-gray-100 text-gray-600") + " ring-1 ring-current" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-[11px] text-blue-600 hover:underline ml-1">
              Clear
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <p className="mt-2 text-[11px] text-gray-400">
            Showing {filteredTickets.length} of {rawTickets.length} tickets
          </p>
        )}
      </div>

      {/* Summary KPI cards */}
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <div className="col-span-1"><KpiCard label="Total" value={summary.total} color="text-gray-900" /></div>
        <div className="col-span-1"><KpiCard label="Completed" value={summary.completed} color="text-green-600" /></div>
        <div className="col-span-1"><KpiCard label="In Progress" value={summary.inProgress} color="text-amber-600" /></div>
        <div className="col-span-1"><KpiCard label="Overdue" value={summary.overdue} color="text-red-600" /></div>
        <div className="col-span-1"><KpiCard label="Blocked" value={summary.blocked} color="text-orange-600" /></div>
        <div className="col-span-1"><KpiCard label="Avg Hours" value={summary.avgHours} sub="to complete" color="text-blue-600" /></div>
        <div className="col-span-1"><KpiCard label="On Time" value={`${summary.onTimePct}%`} sub="of completed" color={summary.onTimePct >= 80 ? "text-green-600" : summary.onTimePct >= 50 ? "text-amber-600" : "text-red-600"} /></div>
        <div className="col-span-1"><KpiCard label="Was Blocker" value={summary.wasBlockerCount} sub="total blocks raised" color="text-purple-600" /></div>
      </div>

      {/* Breakdowns */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BreakdownCard title="By Status">
          <DonutChart data={breakdowns.byStatus} onSegmentClick={(s) => applyChartFilter("status", s)} />
          <p className="text-[10px] text-gray-400 mt-2">Click to filter</p>
        </BreakdownCard>

        {entityType !== "asset" && breakdowns.byProperty.length > 0 && (
          <BreakdownCard title="By Property">
            <HBarChart data={breakdowns.byProperty} onSegmentClick={(s) => applyChartFilter("property", s)} />
            <p className="text-[10px] text-gray-400 mt-2">Click to filter</p>
          </BreakdownCard>
        )}

        <BreakdownCard title="By Category">
          <HBarChart data={breakdowns.byCategory} onSegmentClick={(s) => applyChartFilter("category", s)} />
          <p className="text-[10px] text-gray-400 mt-2">Click to filter</p>
        </BreakdownCard>

        <BreakdownCard title="By Assignee">
          <HBarChart data={breakdowns.byAssignee} onSegmentClick={(s) => applyChartFilter("assignee", s)} />
          <p className="text-[10px] text-gray-400 mt-2">Click to filter</p>
        </BreakdownCard>

        {entityType === "property" && breakdowns.byUnit.filter(s => s.key !== null).length > 0 && (
          <BreakdownCard title="By Unit">
            <HBarChart data={breakdowns.byUnit.filter(s => s.key !== null)} onSegmentClick={(s) => applyChartFilter("unit", s)} />
            <p className="text-[10px] text-gray-400 mt-2">Click to filter</p>
          </BreakdownCard>
        )}

        <BreakdownCard title="By Priority">
          <HBarChart data={breakdowns.byPriority} onSegmentClick={(s) => applyChartFilter("priority", s)} />
          <p className="text-[10px] text-gray-400 mt-2">Click to filter</p>
        </BreakdownCard>
      </div>

      {/* Timeline */}
      <div className="mb-3 rounded-lg bg-white p-4 ring-1 ring-gray-200">
        <h3 className="text-[13px] font-semibold text-gray-800 mb-3">Tickets Created — Last 12 Months</h3>
        <TimelineChart data={breakdowns.byTimeline} />
      </div>

      {/* Ticket Table */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200 overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13px] font-semibold text-gray-800">
              All Tickets
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                {filteredTickets.length}
              </span>
            </h3>
            {chartFilter && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200">
                Filtered by: {chartFilter.type.charAt(0).toUpperCase() + chartFilter.type.slice(1)} = {chartFilter.label}
                <button onClick={clearChartFilter} className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100 transition-colors" title="Remove filter">
                  <X size={10} />
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className={cls.th}>Ticket</th>
                <th className={cls.th}>Name</th>
                <th
                  className={cls.th + " cursor-pointer hover:text-gray-700 select-none"}
                  onClick={() => toggleSort("status")}
                >
                  Status {sortCol === "status" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th className={cls.th}>Priority</th>
                {entityType !== "asset" && <th className={cls.th}>Property</th>}
                <th className={cls.th}>Assignee</th>
                <th
                  className={cls.th + " cursor-pointer hover:text-gray-700 select-none"}
                  onClick={() => toggleSort("dueDate")}
                >
                  Due {sortCol === "dueDate" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
                <th
                  className={cls.th + " cursor-pointer hover:text-gray-700 select-none"}
                  onClick={() => toggleSort("createdAt")}
                >
                  Created {sortCol === "createdAt" && (sortDir === "desc" ? "↓" : "↑")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[13px] text-gray-400">No tickets found</td>
                </tr>
              ) : (
                pagedTickets.map((t) => (
                  <tr key={t.id} className={cls.trClick} onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td className={cls.td}>
                      <Link to={`/tickets/${t.id}`} className={cls.mono + " hover:underline"} onClick={(e) => e.stopPropagation()}>
                        {t.ticketNumber}
                      </Link>
                      {t.isBlocked && (
                        <Badge color="bg-orange-50 text-orange-600" className="ml-1.5 text-[10px]">Blocked</Badge>
                      )}
                    </td>
                    <td className={cls.td}>
                      <p className="max-w-[200px] truncate text-gray-800 text-[13px]">{t.name}</p>
                    </td>
                    <td className={cls.td}>
                      <StatusBadge status={t.status} />
                    </td>
                    <td className={cls.td}>
                      <PriorityBadge priority={t.priority} />
                    </td>
                    {entityType !== "asset" && (
                      <td className={cls.td + " text-[13px] text-gray-500 max-w-[120px] truncate"}>{t.property.name}</td>
                    )}
                    <td className={cls.td + " text-[13px] text-gray-500"}>
                      {t.assignedTo ? (t.assignedTo.fullName ?? t.assignedTo.username) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={cls.td + " text-[13px] text-gray-500"}>{fmtDate(t.dueDate)}</td>
                    <td className={cls.td + " text-[13px] text-gray-500"}>{fmtDate(t.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          pagination={{ page: tablePage, totalPages, total: filteredTickets.length, limit: TABLE_PAGE_SIZE }}
          onPageChange={setTablePage}
        />
      </div>
    </div>
  );
}
