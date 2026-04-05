import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ticketApi, propertyApi, userApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import {
  TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "../../../shared/types";
import {
  Plus,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  SlidersHorizontal,
  X,
} from "lucide-react";

interface Ticket {
  id: string;
  ticketNumber: string;
  name: string;
  taskType: string;
  subTaskType: string;
  priority: string;
  status: string;
  dueDate: string;
  property: { id: string; name: string; code: string };
  unit: { id: string; name: string; code: string };
  category: { id: string; name: string };
  assignedTo: { id: string; username: string; fullName: string; role?: { name: string } } | null;
  activeBlock: { blockingUser: { fullName: string; username: string } | null; department: { name: string } | null } | null;
  completedAt: string | null;
  _count: { comments: number };
}

export default function TicketListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1, limit: 10 });

  // Advanced filters
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState({
    priority: "",
    taskType: "",
    blocked: "",
    propertyId: "",
    assigneeId: "",
    createdById: "",
    createdFrom: "",
    createdTo: "",
    dueDateFrom: "",
    dueDateTo: "",
  });
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string; username: string }[]>([]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Close popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch filter data when popup opens
  useEffect(() => {
    if (!filterOpen || properties.length > 0) return;
    Promise.all([
      propertyApi.list({ limit: 100 }).then((r) => setProperties(r.data.data?.data || r.data.data || [])),
      userApi.list({ limit: 200 }).then((r) => setUsers(r.data.data?.data || r.data.data || [])),
    ]).catch(() => {});
  }, [filterOpen]);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const clearFilter = (key: keyof typeof filters) => setFilter(key, "");
  const clearAll = () => { setFilters({ priority: "", taskType: "", blocked: "", propertyId: "", assigneeId: "", createdById: "", createdFrom: "", createdTo: "", dueDateFrom: "", dueDateTo: "" }); setPage(1); };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (filters.priority) params.priority = filters.priority;
      if (filters.taskType) params.taskType = filters.taskType;
      if (filters.propertyId) params.propertyId = filters.propertyId;
      if (filters.assigneeId) params.assigneeId = filters.assigneeId;
      if (filters.createdById) params.createdById = filters.createdById;
      if (filters.createdFrom) params.createdFrom = filters.createdFrom;
      if (filters.createdTo) params.createdTo = filters.createdTo;
      if (filters.dueDateFrom) params.dueDateFrom = filters.dueDateFrom;
      if (filters.dueDateTo) params.dueDateTo = filters.dueDateTo;
      if (filters.blocked) params.blocked = filters.blocked;

      const res = await ticketApi.list(params);
      setTickets(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, filters]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    const timeout = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const priorityColor = (p: string) => {
    switch (p) {
      case "CRITICAL":
        return "bg-red-50 text-red-600";
      case "HIGH":
        return "bg-orange-50 text-orange-600";
      case "MEDIUM":
        return "bg-yellow-50 text-yellow-600";
      case "LOW":
        return "bg-blue-50 text-blue-600";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "OPEN":
        return "bg-blue-50 text-blue-600";
      case "IN_PROGRESS":
        return "bg-yellow-50 text-yellow-600";
      case "OVERDUE":
        return "bg-red-100 text-red-700";
      case "COMPLETED":
        return "bg-green-50 text-green-600";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Tickets</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            {pagination.total} {pagination.total === 1 ? "ticket" : "tickets"}{" "}
            total
          </p>
        </div>
        {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
          <Link
            to="/tickets/new"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
          >
            <Plus size={18} />
            Create Ticket
          </Link>
        )}
      </div>

      {/* Search + Filters */}
      <div className="mb-4 space-y-3">
        {/* Row 1: search + filter button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or ticket #..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium shadow-sm transition-colors ${activeFilterCount > 0 ? "border-primary-400 bg-primary-50 text-primary-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">{activeFilterCount}</span>
              )}
            </button>

            {/* Filter popup — desktop: absolute dropdown, mobile: bottom sheet */}
            {filterOpen && (
              <>
                {/* Mobile backdrop */}
                <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setFilterOpen(false)} />
              </>
            )}
            {filterOpen && (
              <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl animate-slide-up md:absolute md:inset-auto md:right-0 md:top-full md:z-30 md:mt-2 md:w-80 md:max-h-none md:rounded-xl md:border md:border-gray-200 md:animate-none"
                   style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-800">Filters</span>
                  {activeFilterCount > 0 && (
                    <button onClick={clearAll} className="text-xs text-primary-600 hover:underline">Clear all</button>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Priority</label>
                    <select value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                      <option value="">Any</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Task Type</label>
                    <select value={filters.taskType} onChange={(e) => setFilter("taskType", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                      <option value="">Any</option>
                      <option value="COMPLAIN">Complain</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="INSPECT">Inspect</option>
                      <option value="TASK">Task</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Block Status</label>
                    <select value={filters.blocked} onChange={(e) => setFilter("blocked", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                      <option value="">All</option>
                      <option value="yes">Blocked</option>
                      <option value="no">Not blocked</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Property</label>
                    <select value={filters.propertyId} onChange={(e) => setFilter("propertyId", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                      <option value="">Any</option>
                      {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Assignee</label>
                    <select value={filters.assigneeId} onChange={(e) => setFilter("assigneeId", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                      <option value="">Anyone</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Created By</label>
                    <select value={filters.createdById} onChange={(e) => setFilter("createdById", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                      <option value="">Anyone</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Created Date</label>
                    <div className="flex gap-2">
                      <input type="date" value={filters.createdFrom} onChange={(e) => setFilter("createdFrom", e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
                      <input type="date" value={filters.createdTo} onChange={(e) => setFilter("createdTo", e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500">Due Date</label>
                    <div className="flex gap-2">
                      <input type="date" value={filters.dueDateFrom} onChange={(e) => setFilter("dueDateFrom", e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
                      <input type="date" value={filters.dueDateTo} onChange={(e) => setFilter("dueDateTo", e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
                    </div>
                  </div>
                </div>
                {/* Mobile action buttons */}
                <div className="mt-4 flex gap-2 md:hidden">
                  {activeFilterCount > 0 && (
                    <button onClick={() => { clearAll(); setFilterOpen(false); }} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 active:bg-gray-50">
                      Reset
                    </button>
                  )}
                  <button onClick={() => setFilterOpen(false)} className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white active:bg-primary-700">
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Status quick pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[["", "All"], ["OPEN", "Open"], ["IN_PROGRESS", "In Progress"], ["OVERDUE", "Overdue"], ["COMPLETED", "Completed"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setStatusFilter(val); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === val ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Row 3: Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.priority && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Priority: {filters.priority}<button onClick={() => clearFilter("priority")}><X size={11} /></button></span>}
            {filters.taskType && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Type: {filters.taskType}<button onClick={() => clearFilter("taskType")}><X size={11} /></button></span>}
            {filters.blocked && <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">{filters.blocked === "yes" ? "Blocked" : "Not blocked"}<button onClick={() => clearFilter("blocked")}><X size={11} /></button></span>}
            {filters.propertyId && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Property: {properties.find(p => p.id === filters.propertyId)?.name || "…"}<button onClick={() => clearFilter("propertyId")}><X size={11} /></button></span>}
            {filters.assigneeId && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Assignee: {users.find(u => u.id === filters.assigneeId)?.fullName || "…"}<button onClick={() => clearFilter("assigneeId")}><X size={11} /></button></span>}
            {filters.createdById && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Created by: {users.find(u => u.id === filters.createdById)?.fullName || "…"}<button onClick={() => clearFilter("createdById")}><X size={11} /></button></span>}
            {(filters.createdFrom || filters.createdTo) && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Created: {filters.createdFrom || "…"} → {filters.createdTo || "…"}<button onClick={() => { clearFilter("createdFrom"); clearFilter("createdTo"); }}><X size={11} /></button></span>}
            {(filters.dueDateFrom || filters.dueDateTo) && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">Due: {filters.dueDateFrom || "…"} → {filters.dueDateTo || "…"}<button onClick={() => { clearFilter("dueDateFrom"); clearFilter("dueDateTo"); }}><X size={11} /></button></span>}
          </div>
        )}
      </div>

      {/* Loading / Empty states */}
      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 size={48} className="animate-spin text-gray-300" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <ClipboardList size={48} className="text-gray-300" />
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">No tickets found</p>
            <p className="mt-1 text-[13px] text-gray-400">Create your first ticket to start tracking</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Mobile Card View (≤768px) ── */}
          <div className="space-y-3 md:hidden">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/tickets/${ticket.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50 transition-colors"
              >
                {/* Top row: ticket # + priority */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-primary-600">
                    {ticket.ticketNumber}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityColor(ticket.priority)}`}>
                    {PRIORITY_LABELS[ticket.priority]}
                  </span>
                </div>

                {/* Title */}
                <p className="mt-1.5 text-sm font-semibold text-gray-900 leading-snug">
                  {ticket.name}
                </p>

                {/* Assignee */}
                {ticket.assignedTo && (
                  <p className="mt-1 text-xs text-gray-500">
                    {ticket.assignedTo.fullName || ticket.assignedTo.username}
                  </p>
                )}

                {/* Bottom row: status + type + property + due */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor(ticket.status)}`}>
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </span>
                  {ticket.activeBlock && (
                    <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                      Blocked
                    </span>
                  )}
                  {ticket.status === "COMPLETED" && ticket.completedAt && ticket.dueDate && new Date(ticket.completedAt) > new Date(ticket.dueDate) && (
                    <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600">Late</span>
                  )}
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-gray-500">{TASK_TYPE_LABELS[ticket.taskType]}</span>
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-gray-500">{ticket.property.name}</span>
                </div>

                {/* Due date row */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Due {new Date(ticket.dueDate).toLocaleDateString()}
                  </span>
                  {ticket.status === "OVERDUE" && (
                    <span className="text-[11px] font-semibold text-red-500">
                      {Math.ceil((new Date().getTime() - new Date(ticket.dueDate).getTime()) / 86400000)}d overdue
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* ── Desktop Table View (>768px) ── */}
          <div className="hidden md:block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Ticket #</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Property</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Priority</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Block</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Assigned To</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Due Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-gray-100/80 transition-colors duration-150 hover:bg-gray-50/80">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-primary-600">{ticket.ticketNumber}</td>
                      <td className="px-5 py-3.5 font-medium">{ticket.name}</td>
                      <td className="px-5 py-3.5 text-gray-600">{TASK_TYPE_LABELS[ticket.taskType]}</td>
                      <td className="px-5 py-3.5">
                        <Link to={`/properties/${ticket.property.id}`} className="text-primary-600 hover:underline">{ticket.property.name}</Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${priorityColor(ticket.priority)}`}>{PRIORITY_LABELS[ticket.priority]}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(ticket.status)}`}>{TICKET_STATUS_LABELS[ticket.status]}</span>
                          {ticket.status === "COMPLETED" && ticket.completedAt && ticket.dueDate && new Date(ticket.completedAt) > new Date(ticket.dueDate) && (
                            <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">Late</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {ticket.activeBlock ? (
                          <div>
                            <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Blocked</span>
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {ticket.activeBlock.blockingUser
                                ? `${ticket.activeBlock.blockingUser.fullName || ticket.activeBlock.blockingUser.username}`
                                : ticket.activeBlock.department?.name}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {ticket.assignedTo ? (
                          <span className="text-sm">
                            {ticket.assignedTo.fullName || ticket.assignedTo.username}
                            {ticket.assignedTo.role && <span className="ml-1 text-xs text-gray-400">({ticket.assignedTo.role.name})</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-gray-600">{new Date(ticket.dueDate).toLocaleDateString()}</span>
                        {ticket.status === "OVERDUE" && (
                          <p className="text-[11px] font-medium text-red-500">{Math.ceil((new Date().getTime() - new Date(ticket.dueDate).getTime()) / 86400000)}d overdue</p>
                        )}
                        {ticket.status === "COMPLETED" && ticket.completedAt && new Date(ticket.completedAt) > new Date(ticket.dueDate) && (
                          <p className="text-[11px] font-medium text-orange-500">{Math.ceil((new Date(ticket.completedAt).getTime() - new Date(ticket.dueDate).getTime()) / 86400000)}d late</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link to={`/tickets/${ticket.id}`} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="View">
                          <Eye size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-950/5 md:mt-0 md:rounded-none md:border-t md:border-gray-200 md:shadow-none md:ring-0">
          <span className="text-sm text-gray-600">
            {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium">{page} / {pagination.totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="rounded-lg border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile FAB — Create Ticket */}
      {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
        <Link
          to="/tickets/new"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 active:bg-primary-700 transition-colors md:hidden"
        >
          <Plus size={24} />
        </Link>
      )}
    </div>
  );
}
