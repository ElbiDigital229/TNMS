import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { dashboardApi, todoApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
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
  TrendingUp,
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
    dueDate: string;
    property: { name: string };
    category: { name: string };
  }>;
}

export default function DashboardPage() {
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

  const priorityColor = (p: string) => {
    switch (p) {
      case "CRITICAL": return "bg-red-500";
      case "HIGH": return "bg-orange-500";
      case "MEDIUM": return "bg-yellow-500";
      case "LOW": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "OPEN": return "bg-blue-500";
      case "IN_PROGRESS": return "bg-yellow-500";
      case "COMPLETED": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const taskTypeColor = (t: string) => {
    switch (t) {
      case "COMPLAIN": return "bg-red-500";
      case "MAINTENANCE": return "bg-orange-500";
      case "INSPECT": return "bg-purple-500";
      case "TASK": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const priorityBadge = (p: string) => {
    switch (p) {
      case "CRITICAL": return "bg-red-50 text-red-600";
      case "HIGH": return "bg-orange-50 text-orange-600";
      case "MEDIUM": return "bg-yellow-50 text-yellow-600";
      case "LOW": return "bg-blue-50 text-blue-600";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "OPEN": return "bg-blue-50 text-blue-600";
      case "IN_PROGRESS": return "bg-yellow-50 text-yellow-600";
      case "COMPLETED": return "bg-green-50 text-green-600";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const totalTickets = stats.totals.tickets;



  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Overview of your True North Management System.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/properties"
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Properties</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {stats.totals.properties}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-2">
              <Building2 className="text-blue-600" size={24} />
            </div>
          </div>
        </Link>

        <Link
          to="/units"
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Units</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {stats.totals.units}
              </p>
            </div>
            <div className="rounded-lg bg-purple-50 p-2">
              <Layers className="text-purple-600" size={24} />
            </div>
          </div>
        </Link>

        <Link
          to="/assets"
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Assets</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {stats.totals.assets}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-2">
              <Package className="text-green-600" size={24} />
            </div>
          </div>
        </Link>

        <Link
          to="/tickets"
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tickets</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {stats.totals.tickets}
              </p>
            </div>
            <div className="rounded-lg bg-orange-50 p-2">
              <ClipboardList className="text-orange-600" size={24} />
            </div>
          </div>
        </Link>
      </div>

      {/* Ticket Metrics Row */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          to="/tickets?status=OPEN"
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-50 p-2">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Overdue Tickets</p>
              <p className="text-2xl font-semibold text-red-600">
                {stats.tickets.overdue}
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/tickets?status=COMPLETED"
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-50 p-2">
              <CheckCircle2 className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completion Rate</p>
              <p className="text-2xl font-semibold text-green-600">
                {stats.tickets.completionRate}%
              </p>
            </div>
          </div>
        </Link>

      </div>

      {/* To-Do Widget */}
      {todoStats && (
        <div className="mb-6">
          <Link
            to="/todos"
            className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5 transition-all duration-200 hover:shadow-md"
          >
            <div className="rounded-lg bg-primary-50 p-2.5">
              <ListChecks className="text-primary-600" size={22} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Tasks Due Today</p>
              <p className="mt-0.5 text-[13px] text-gray-500">
                {todoStats.dueToday === 0
                  ? "No tasks due today"
                  : `${todoStats.dueToday} task${todoStats.dueToday === 1 ? "" : "s"} due today`}
                {todoStats.overdue > 0 && (
                  <span className="text-red-500"> · {todoStats.overdue} overdue</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-4 text-center">
              <div>
                <p className="text-2xl font-semibold text-primary-600">{todoStats.dueToday}</p>
                <p className="text-[11px] text-gray-400">Today</p>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div>
                <p className="text-2xl font-semibold text-gray-900">{todoStats.open}</p>
                <p className="text-[11px] text-gray-400">Open</p>
              </div>
              <div className="h-8 w-px bg-gray-100" />
              <div>
                <p className="text-2xl font-semibold text-green-600">{todoStats.completed}</p>
                <p className="text-[11px] text-gray-400">Done</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Breakdown Charts */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* By Status */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <h3 className="mb-4 text-[13px] font-semibold text-gray-900">
            Tickets by Status
          </h3>
          {totalTickets === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-400">
              <Inbox size={28} className="mb-2" />
              <p className="text-sm">No tickets yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.tickets.byStatus).map(([key, count]) => (
                <Link
                  key={key}
                  to={`/tickets?status=${key}`}
                  className="block rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {TICKET_STATUS_LABELS[key]}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100/80">
                    <div
                      className={`h-full rounded-full ${statusColor(key)} transition-all duration-500`}
                      style={{
                        width: `${totalTickets > 0 ? (count / totalTickets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* By Priority */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <h3 className="mb-4 text-[13px] font-semibold text-gray-900">
            Tickets by Priority
          </h3>
          {totalTickets === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-400">
              <Inbox size={28} className="mb-2" />
              <p className="text-sm">No tickets yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.tickets.byPriority).map(([key, count]) => (
                <Link
                  key={key}
                  to={`/tickets?priority=${key}`}
                  className="block rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {PRIORITY_LABELS[key]}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100/80">
                    <div
                      className={`h-full rounded-full ${priorityColor(key)} transition-all duration-500`}
                      style={{
                        width: `${totalTickets > 0 ? (count / totalTickets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* By Task Type */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <h3 className="mb-4 text-[13px] font-semibold text-gray-900">
            Tickets by Type
          </h3>
          {totalTickets === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-400">
              <Inbox size={28} className="mb-2" />
              <p className="text-sm">No tickets yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.tickets.byTaskType).map(([key, count]) => (
                <Link
                  key={key}
                  to={`/tickets?taskType=${key}`}
                  className="block rounded-lg px-2 py-1 -mx-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {TASK_TYPE_LABELS[key]}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100/80">
                    <div
                      className={`h-full rounded-full ${taskTypeColor(key)} transition-all duration-500`}
                      style={{
                        width: `${totalTickets > 0 ? (count / totalTickets) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-[13px] font-semibold text-gray-900">
            Recent Tickets
          </h3>
          <Link
            to="/tickets"
            className="text-xs font-medium text-primary-600 hover:underline"
          >
            View all
          </Link>
        </div>
        {stats.recentTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-12 text-gray-400">
            <Inbox size={32} className="mb-3" />
            <p className="text-sm font-medium text-gray-500">No tickets yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Tickets will appear here once created.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="space-y-2 p-4 md:hidden">
              {stats.recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="block rounded-lg border border-gray-100 bg-gray-50/50 p-3 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-primary-600">{ticket.ticketNumber}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityBadge(ticket.priority)}`}>
                      {PRIORITY_LABELS[ticket.priority]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900 leading-snug">{ticket.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge(ticket.status)}`}>
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </span>
                    <span className="text-[11px] text-gray-400">·</span>
                    <span className="text-[11px] text-gray-500">{ticket.property.name}</span>
                    <span className="text-[11px] text-gray-400">·</span>
                    <span className="text-[11px] text-gray-400">Due {new Date(ticket.dueDate).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Ticket</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Property</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Priority</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-gray-50 transition-colors duration-150 hover:bg-gray-50/80">
                      <td className="px-5 py-3">
                        <Link to={`/tickets/${ticket.id}`} className="font-mono text-xs font-medium text-primary-600 hover:underline">
                          {ticket.ticketNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-medium">{ticket.name}</td>
                      <td className="px-5 py-3 text-gray-600">{ticket.property.name}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadge(ticket.priority)}`}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(ticket.status)}`}>
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{new Date(ticket.dueDate).toLocaleDateString()}</td>
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
