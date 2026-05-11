import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { userApi, departmentApi, propertyApi, assetApi, reportApi } from "../lib/api";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { TableLoading } from "../components/ui/DataTable";
import {
  Users, Building2, LayoutGrid, Package, Search, ChevronRight, Settings2,
  BarChart3, Clock, CheckCircle2, AlertTriangle, ShieldCheck, ArrowUpDown,
  FileText, Loader2,
} from "lucide-react";
import { downloadReportPdf } from "../lib/downloadReportPdf";

// ─── Shared constants ────────────────────────────────────────────────────────

const MIN_SEARCH_CHARS: Record<string, number> = { asset: 2, user: 0, property: 0, department: 0 };

type EntityType = "user" | "department" | "property" | "asset";
type TabType = "dashboard" | "entity";

interface Option { id: string; label: string; sub?: string; }

const ENTITY_CONFIG = {
  user: {
    label: "User",
    description: "View all ticket activity for a specific person",
    icon: Users,
    color: "bg-blue-50 text-blue-600 ring-blue-100",
    activeColor: "ring-2 ring-blue-500 bg-blue-50",
  },
  department: {
    label: "Department",
    description: "See how a department is handling tickets",
    icon: LayoutGrid,
    color: "bg-purple-50 text-purple-600 ring-purple-100",
    activeColor: "ring-2 ring-purple-500 bg-purple-50",
  },
  property: {
    label: "Property",
    description: "Full ticket and asset report for a property",
    icon: Building2,
    color: "bg-green-50 text-green-600 ring-green-100",
    activeColor: "ring-2 ring-green-500 bg-green-50",
  },
  asset: {
    label: "Asset",
    description: "History of all tickets linked to an asset",
    icon: Package,
    color: "bg-orange-50 text-orange-600 ring-orange-100",
    activeColor: "ring-2 ring-orange-500 bg-orange-50",
  },
} as const;

const CHART_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6"];

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#3b82f6",
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: "#22c55e",
  good: "#3b82f6",
  fair: "#f59e0b",
  poor: "#ef4444",
};

// ─── Dashboard Types ─────────────────────────────────────────────────────────

interface DashboardData {
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    overdue: number;
    completed: number;
    avgResolutionHours: number;
    slaComplianceRate: number;
    overdueRate: number;
  };
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByProperty: { propertyId: string; propertyName: string; count: number }[];
  ticketsTrend: { month: string; created: number; completed: number }[];
  techPerformance: { userId: string; name: string; assigned: number; completed: number; avgHours: number; slaRate: number }[];
  assetHealth: Record<string, number>;
}

// ─── KPI Stat Card ───────────────────────────────────────────────────────────

function KpiCard({ icon, iconBg, label, value, sub }: { icon: React.ReactNode; iconBg: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white p-3.5 ring-1 ring-gray-200">
      <div className={`rounded-md p-2 ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-[12px] text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────

function DonutChart({ data, colorMap }: { data: { key: string; label: string; count: number }[]; colorMap?: Record<string, string> }) {
  const filtered = data.filter((d) => d.count > 0);
  if (filtered.length === 0) return <p className="text-[13px] text-gray-400 py-4 text-center">No data</p>;
  const total = filtered.reduce((s, d) => s + d.count, 0);
  if (total === 0) return <p className="text-[13px] text-gray-400 py-4 text-center">No data</p>;

  const R = 70; const r = 42; const CX = 90; const CY = 90;
  let angle = -Math.PI / 2;

  const slices = filtered.map((row, i) => {
    const sweep = (row.count / total) * 2 * Math.PI;
    const x1o = CX + R * Math.cos(angle); const y1o = CY + R * Math.sin(angle);
    const x1i = CX + r * Math.cos(angle); const y1i = CY + r * Math.sin(angle);
    angle += sweep;
    const x2o = CX + R * Math.cos(angle); const y2o = CY + R * Math.sin(angle);
    const x2i = CX + r * Math.cos(angle); const y2i = CY + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${R} ${R} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${r} ${r} 0 ${large} 0 ${x1i} ${y1i} Z`;
    const color = colorMap?.[row.key] ?? CHART_COLORS[i % CHART_COLORS.length];
    return { path, color, label: row.label, count: row.count, pct: Math.round((row.count / total) * 100) };
  });

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
      <svg viewBox="0 0 180 180" className="w-36 shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth={1.5}>
            <title>{`${s.label}: ${s.count} (${s.pct}%)`}</title>
          </path>
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={14} fontWeight="bold" fill="#111827">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize={9} fill="#9ca3af">total</text>
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
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

// ─── SVG Horizontal Bar Chart ────────────────────────────────────────────────

function HBarChart({ data }: { data: { label: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-[13px] text-gray-400 py-4 text-center">No data</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2.5">
      {data.slice(0, 10).map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-28 shrink-0 text-[11px] text-gray-600 truncate text-right" title={row.label}>{row.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-500"
              style={{ width: `${(row.count / max) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length], minWidth: row.count > 0 ? 6 : 0 }}
            />
          </div>
          <span className="w-7 shrink-0 text-right text-[11px] font-semibold text-gray-700">{row.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Trend Line Chart (two lines: created + completed) ───────────────────

function TrendLineChart({ data }: { data: { month: string; created: number; completed: number }[] }) {
  if (data.length === 0) return <p className="text-[13px] text-gray-400 py-4 text-center">No data</p>;

  const W = 560; const H = 200;
  const PAD = { top: 16, right: 16, bottom: 44, left: 36 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.flatMap((d) => [d.created, d.completed]), 1);
  const xStep = cW / Math.max(data.length - 1, 1);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxVal));

  function buildPath(values: number[]) {
    return values.map((v, i) => {
      const x = PAD.left + i * xStep;
      const y = PAD.top + cH - (v / maxVal) * cH;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    }).join(" ");
  }

  const createdPath = buildPath(data.map((d) => d.created));
  const completedPath = buildPath(data.map((d) => d.completed));

  const monthLabels = data.map((d) => {
    const [y, m] = d.month.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short" });
  });

  return (
    <div>
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
        <path d={createdPath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={completedPath} fill="none" stroke="#22c55e" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,3" />
        {data.map((d, i) => {
          const x = PAD.left + i * xStep;
          return (
            <g key={i}>
              <circle cx={x} cy={PAD.top + cH - (d.created / maxVal) * cH} r={3} fill="#3b82f6" />
              <circle cx={x} cy={PAD.top + cH - (d.completed / maxVal) * cH} r={3} fill="#22c55e" />
            </g>
          );
        })}
        {monthLabels.map((label, i) => {
          const x = PAD.left + i * xStep;
          return (
            <text key={i} x={x} y={H - 10} textAnchor="middle" fontSize={9} fill="#9ca3af">{label}</text>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 justify-center mt-1">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="h-0.5 w-4 bg-blue-500 rounded" />
          <span className="text-gray-600">Created</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="h-0.5 w-4 bg-emerald-500 rounded border-dashed" style={{ borderTop: "2px dashed #22c55e", height: 0 }} />
          <span className="text-gray-600">Completed</span>
        </div>
      </div>
    </div>
  );
}

// ─── Chart Card wrapper ──────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
      <h3 className="text-[13px] font-semibold text-gray-800 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ─── Dashboard Tab Content ───────────────────────────────────────────────────

function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [techSort, setTechSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "assigned", dir: "desc" });
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const exportPdf = async () => {
    if (!dashboardRef.current) return;
    setDownloadingPdf(true);
    try {
      await downloadReportPdf(dashboardRef.current, {
        filename: `dashboard-report-${new Date().toISOString().slice(0, 10)}.pdf`,
        title: "Reports Dashboard",
        subtitle: `Generated ${new Date().toLocaleString()}`,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    reportApi.getDashboard()
      .then((res) => setData(res.data.data))
      .catch(() => setError("Failed to load dashboard data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <TableLoading />;
  if (error) return <p className="text-[13px] text-red-500 py-8 text-center">{error}</p>;
  if (!data) return null;

  const sortedTech = [...data.techPerformance].sort((a, b) => {
    const av = (a as any)[techSort.field];
    const bv = (b as any)[techSort.field];
    return techSort.dir === "desc" ? bv - av : av - bv;
  });

  function toggleTechSort(field: string) {
    setTechSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  const priorityDonutData = data.ticketsByPriority.map((p) => ({
    key: p.priority,
    label: p.priority.charAt(0) + p.priority.slice(1).toLowerCase(),
    count: p.count,
  }));

  const assetDonutData = Object.entries(data.assetHealth).map(([key, count]) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    count,
  }));

  const propertyBarData = data.ticketsByProperty.map((p) => ({
    label: p.propertyName,
    count: p.count,
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={exportPdf}
          className={cls.btnSecondary}
          disabled={downloadingPdf}
          title="Download dashboard as PDF"
        >
          {downloadingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
          {downloadingPdf ? "Generating…" : "Download PDF"}
        </button>
      </div>
      <div ref={dashboardRef} className="space-y-4">
      {/* Row 1: KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<BarChart3 size={16} />}
          iconBg="bg-blue-50 text-blue-600"
          label="Total Tickets"
          value={data.tickets.total.toLocaleString()}
        />
        <KpiCard
          icon={<Clock size={16} />}
          iconBg="bg-amber-50 text-amber-600"
          label="Avg Resolution"
          value={`${data.tickets.avgResolutionHours}h`}
        />
        <KpiCard
          icon={<ShieldCheck size={16} />}
          iconBg="bg-emerald-50 text-emerald-600"
          label="SLA Compliance"
          value={`${data.tickets.slaComplianceRate}%`}
        />
        <KpiCard
          icon={<AlertTriangle size={16} />}
          iconBg="bg-red-50 text-red-600"
          label="Overdue Rate"
          value={`${data.tickets.overdueRate}%`}
          sub={`${data.tickets.overdue} overdue of ${data.tickets.total}`}
        />
      </div>

      {/* Row 2: Trend + Priority */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Ticket Trend (Last 6 Months)">
          <TrendLineChart data={data.ticketsTrend} />
        </ChartCard>
        <ChartCard title="Tickets by Priority">
          <DonutChart data={priorityDonutData} colorMap={PRIORITY_COLORS} />
        </ChartCard>
      </div>

      {/* Row 3: Property + Asset Health */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Tickets by Property (Top 10)">
          <HBarChart data={propertyBarData} />
        </ChartCard>
        <ChartCard title="Asset Health">
          <DonutChart data={assetDonutData} colorMap={CONDITION_COLORS} />
        </ChartCard>
      </div>

      {/* Row 4: Technician Performance Table */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200 overflow-hidden">
        <div className="px-4 pt-3 pb-2">
          <h3 className="text-[13px] font-semibold text-gray-800">Technician Performance</h3>
        </div>
        {sortedTech.length === 0 ? (
          <p className="text-[13px] text-gray-400 py-6 text-center">No technician data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={cls.table}>
              <thead>
                <tr className="border-b border-gray-100">
                  {[
                    { key: "name", label: "Name" },
                    { key: "assigned", label: "Assigned" },
                    { key: "completed", label: "Completed" },
                    { key: "avgHours", label: "Avg Hours" },
                    { key: "slaRate", label: "SLA %" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.key !== "name" && toggleTechSort(col.key)}
                      className={`${cls.th} ${col.key !== "name" ? "cursor-pointer select-none hover:text-gray-600" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.key !== "name" && (
                          <ArrowUpDown size={10} className={techSort.field === col.key ? "text-primary-600" : "text-gray-300"} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedTech.map((tech) => (
                  <tr key={tech.userId} className={cls.tr}>
                    <td className={`${cls.td} font-medium text-gray-900`}>{tech.name}</td>
                    <td className={cls.td}>{tech.assigned}</td>
                    <td className={cls.td}>{tech.completed}</td>
                    <td className={cls.td}>{tech.avgHours}h</td>
                    <td className={cls.td}>
                      <span className={`font-medium ${tech.slaRate >= 80 ? "text-emerald-600" : tech.slaRate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {tech.slaRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

// ─── Entity Reports Tab Content ──────────────────────────────────────────────

function EntityReportsTab() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doFetch = useCallback((type: EntityType, q: string) => {
    const minChars = MIN_SEARCH_CHARS[type] ?? 0;
    if (q.length < minChars) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDropdownOpen(true);

    const fetchers: Record<EntityType, () => Promise<Option[]>> = {
      user: async () => {
        const res = await userApi.list({ search: q, limit: 30 });
        const items = res.data.data?.data ?? res.data.data ?? [];
        return items.map((u: any) => ({ id: u.id, label: u.fullName || u.username, sub: u.role?.name }));
      },
      department: async () => {
        const res = await departmentApi.list();
        const items: any[] = res.data.data ?? [];
        return items
          .filter((d: any) => !q || d.name.toLowerCase().includes(q.toLowerCase()))
          .map((d: any) => ({ id: d.id, label: d.name }));
      },
      property: async () => {
        const res = await propertyApi.list({ search: q, limit: 30 });
        const items = res.data.data?.data ?? res.data.data ?? [];
        return items.map((p: any) => ({ id: p.id, label: p.name, sub: p.city }));
      },
      asset: async () => {
        const res = await assetApi.listAll({ search: q, limit: 30 });
        const items = res.data.data?.data ?? res.data.data ?? [];
        return items.map((a: any) => ({ id: a.id, label: a.name, sub: a.code }));
      },
    };

    fetchers[type]()
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedType) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(selectedType, search.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [selectedType, search, doFetch]);

  const handleSelect = (option: Option) => {
    navigate(`/reports/${selectedType}/${option.id}`);
  };

  const handleTypeSelect = (type: EntityType) => {
    setSelectedType(type);
    setSearch("");
    setOptions([]);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-3 sm:grid-cols-4">
        {(Object.keys(ENTITY_CONFIG) as EntityType[]).map((type) => {
          const cfg = ENTITY_CONFIG[type];
          const Icon = cfg.icon;
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className={`flex flex-col items-start gap-2 rounded-lg p-3 text-left ring-1 transition-all ${
                isSelected ? cfg.activeColor : "bg-white ring-gray-200 hover:ring-gray-300"
              }`}
            >
              <div className={`rounded-lg p-2 ring-1 ${cfg.color}`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">{cfg.label}</p>
                <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{cfg.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selectedType && (
        <div className="relative" ref={dropdownRef}>
          <p className={cls.label}>
            Search {ENTITY_CONFIG[selectedType].label}
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => { setDropdownOpen(true); if (!search.trim()) doFetch(selectedType, ""); }}
              placeholder={selectedType === "asset" ? "Type asset name or code..." : `Search ${ENTITY_CONFIG[selectedType].label.toLowerCase()}...`}
              className={`${cls.input} pl-9`}
            />
          </div>

          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg bg-white ring-1 ring-gray-200 shadow-lg overflow-hidden">
              {loading ? (
                <TableLoading />
              ) : search.trim().length < (MIN_SEARCH_CHARS[selectedType] ?? 0) ? (
                <div className="py-8 text-center text-[13px] text-gray-400">
                  Type at least {MIN_SEARCH_CHARS[selectedType]} characters to search
                </div>
              ) : options.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-gray-400">No results</div>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {options.map((opt) => (
                    <li key={opt.id}>
                      <button
                        onClick={() => handleSelect(opt)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="text-[13px] font-medium text-gray-900">{opt.label}</p>
                          {opt.sub && <p className="text-[11px] text-gray-500">{opt.sub}</p>}
                        </div>
                        <ChevronRight size={14} className="text-gray-300" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between mb-1">
        <PageHeader
          title="Reports"
          subtitle={activeTab === "dashboard" ? "Cross-entity KPIs and performance overview." : "Select an entity to generate a full report automatically."}
        />
        <Link to="/reports/builder" className={cls.btnSecondary}>
          <Settings2 size={15} />
          Report Builder
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {([
          { key: "dashboard" as TabType, label: "Dashboard", icon: BarChart3 },
          { key: "entity" as TabType, label: "Entity Reports", icon: Users },
        ]).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "dashboard" ? <DashboardTab /> : <EntityReportsTab />}
    </div>
  );
}
