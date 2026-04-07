import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dashboardApi, todoApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls, STATUS_BAR, PRIORITY_BAR, TASK_TYPE_BAR } from "../lib/styles";
import { StatusBadge, PriorityBadge } from "../components/ui/Badge";
import StatCard from "../components/ui/StatCard";
import { EmptyState } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "../../../shared/types";
import {
  Building2,
  Layers,
  Package,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  ListChecks,
} from "lucide-react";

interface DashboardStats {
  totals: {
    properties: number;
    units: number;
    assets: number;
    tickets: number;
  };
  tickets: {
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byTaskType: Record<string, number>;
    completionRate: number;
    avgCompletionTimeHours: number;
    overdue: number;
  };
  recentTickets: Array<{
    id: string;
    ticketNumber: string;
    name: string;
    status: string;
    priority: string;
    dueDate: string | null;
    property: { name: string };
    category: { name: string };
  }>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todoStats, setTodoStats] = useState<{ open: number; completed: number; overdue: number; dueToday: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.getStats(),
      todoApi.getStats(),
    ])
      .then(([dashRes, todoRes]) => {
        setStats(dashRes.data.data);
        setTodoStats(todoRes.data.data);
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  if (!stats) return null;

  const totalTickets = stats.totals.tickets;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of your True North Management System." />

      {/* Summary Cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard to="/properties" icon={<Building2 size={20} />} iconBg="bg-blue-50 text-blue-600" label="Properties" value={stats.totals.properties} />
        <StatCard to="/units" icon={<Layers size={20} />} iconBg="bg-purple-50 text-purple-600" label="Units" value={stats.totals.units} />
        <StatCard to="/assets" icon={<Package size={20} />} iconBg="bg-green-50 text-green-600" label="Assets" value={stats.totals.assets} />
        <StatCard to="/tickets" icon={<ClipboardList size={20} />} iconBg="bg-orange-50 text-orange-600" label="Tickets" value={stats.totals.tickets} />
      </div>

      {/* Ticket Metrics Row */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard to="/tickets" icon={<AlertTriangle size={18} />} iconBg="bg-red-50 text-red-600" label="Overdue Tickets" value={stats.tickets.overdue} valueColor="text-red-600" />
        <StatCard to="/tickets?status=COMPLETED" icon={<CheckCircle2 size={18} />} iconBg="bg-green-50 text-green-600" label="Completion Rate" value={`${stats.tickets.completionRate}%`} valueColor="text-green-600" />
      </div>

      {/* To-Do Widget */}
      {todoStats && (
        <div className="mb-4">
          <Link
            to="/todos"
            className="flex items-center gap-4 rounded-lg bg-white p-3.5 ring-1 ring-gray-200 transition-all hover:ring-gray-300 hover:shadow-sm"
          >
            <div className="rounded-md bg-primary-50 p-2">
              <ListChecks className="text-primary-600" size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-medium text-gray-900">Tasks Due Today</p>
              <p className="text-[12px] text-gray-500">
                {todoStats.dueToday === 0
                  ? "No tasks due today"
                  : `${todoStats.dueToday} task${todoStats.dueToday === 1 ? "" : "s"} due today`}
                {todoStats.overdue > 0 && (
                  <span className="text-red-500"> · {todoStats.overdue} overdue</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 text-center">
              <div>
                <p className="text-lg font-semibold text-primary-600">{todoStats.dueToday}</p>
                <p className="text-[11px] text-gray-400">Today</p>
              </div>
              <div className="h-7 w-px bg-gray-100" />
              <div>
                <p className="text-lg font-semibold text-gray-900">{todoStats.open}</p>
                <p className="text-[11px] text-gray-400">Open</p>
              </div>
              <div className="h-7 w-px bg-gray-100" />
              <div>
                <p className="text-lg font-semibold text-green-600">{todoStats.completed}</p>
                <p className="text-[11px] text-gray-400">Done</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Breakdown Charts */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownChart title="Tickets by Status" data={stats.tickets.byStatus} labels={TICKET_STATUS_LABELS} barColors={STATUS_BAR} totalTickets={totalTickets} linkPrefix="/tickets?status=" />
        <BreakdownChart title="Tickets by Priority" data={stats.tickets.byPriority} labels={PRIORITY_LABELS} barColors={PRIORITY_BAR} totalTickets={totalTickets} linkPrefix="/tickets?priority=" />
        <BreakdownChart title="Tickets by Type" data={stats.tickets.byTaskType} labels={TASK_TYPE_LABELS} barColors={TASK_TYPE_BAR} totalTickets={totalTickets} linkPrefix="/tickets?taskType=" />
      </div>

      {/* Recent Tickets */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
          <h3 className="text-[13px] font-semibold text-gray-900">Recent Tickets</h3>
          <Link to="/tickets" className="text-[12px] font-medium text-primary-600 hover:underline">View all</Link>
        </div>
        {stats.recentTickets.length === 0 ? (
          <EmptyState icon={<Inbox size={28} />} title="No tickets yet" subtitle="Tickets will appear here once created." />
        ) : (
          <>
            {/* Mobile card view */}
            <div className="space-y-1.5 p-3 md:hidden">
              {stats.recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="block rounded-md border border-gray-100 bg-gray-50/50 p-3 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className={cls.mono}>{ticket.ticketNumber}</span>
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                  <p className="mt-1 text-[13px] font-medium text-gray-900 leading-snug">{ticket.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={ticket.status} />
                    <span className="text-[11px] text-gray-400">·</span>
                    <span className="text-[11px] text-gray-500">{ticket.property.name}</span>
                    <span className="text-[11px] text-gray-400">·</span>
                    <span className="text-[11px] text-gray-400">{ticket.dueDate ? `Due ${new Date(ticket.dueDate).toLocaleDateString()}` : "No due date"}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className={cls.table}>
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className={cls.th}>Ticket</th>
                    <th className={cls.th}>Name</th>
                    <th className={cls.th}>Property</th>
                    <th className={cls.th}>Priority</th>
                    <th className={cls.th}>Status</th>
                    <th className={cls.th}>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTickets.map((ticket) => (
                    <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} className={cls.trClick}>
                      <td className={cls.td}><span className={cls.mono}>{ticket.ticketNumber}</span></td>
                      <td className={`${cls.td} font-medium text-gray-900`}>{ticket.name}</td>
                      <td className={`${cls.td} text-gray-600`}>{ticket.property.name}</td>
                      <td className={cls.td}><PriorityBadge priority={ticket.priority} /></td>
                      <td className={cls.td}><StatusBadge status={ticket.status} /></td>
                      <td className={`${cls.td} text-gray-600`}>{ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Breakdown Chart (local helper) ── */
function BreakdownChart({ title, data, labels, barColors, totalTickets, linkPrefix }: {
  title: string;
  data: Record<string, number>;
  labels: Record<string, string>;
  barColors: Record<string, string>;
  totalTickets: number;
  linkPrefix: string;
}) {
  return (
    <div className="rounded-lg bg-white p-3.5 ring-1 ring-gray-200">
      <h3 className="mb-3 text-[13px] font-semibold text-gray-900">{title}</h3>
      {totalTickets === 0 ? (
        <EmptyState icon={<Inbox size={24} />} title="No tickets yet" />
      ) : (
        <div className="space-y-2.5">
          {Object.entries(data).map(([key, count]) => (
            <Link key={key} to={`${linkPrefix}${key}`} className="block rounded-md px-2 py-0.5 -mx-2 hover:bg-gray-50 transition-colors">
              <div className="mb-0.5 flex items-center justify-between text-[13px]">
                <span className="text-gray-600">{labels[key] || key}</span>
                <span className="font-medium">{count}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100/80">
                <div
                  className={`h-full rounded-full ${barColors[key] || "bg-gray-500"} transition-all duration-500`}
                  style={{ width: `${totalTickets > 0 ? (count / totalTickets) * 100 : 0}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
