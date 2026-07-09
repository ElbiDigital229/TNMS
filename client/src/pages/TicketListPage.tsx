import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ticketApi, propertyApi, userApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { TASK_TYPE_LABELS, computeUrgency } from "../../../shared/types";
import { cls } from "../lib/styles";
import { StatusBadge, PriorityBadge, UrgencyBadge, Badge } from "../components/ui/Badge";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import BulkImportModal from "../components/ui/BulkImportModal";
import Modal from "../components/ui/Modal";
import MultiSelect from "../components/ui/MultiSelect";
import {
  Plus, Search, Eye, ChevronUp, ChevronDown,
  ClipboardList, X, ArrowUpDown, Upload, SlidersHorizontal,
  Trash2, RotateCcw, Archive, History,
} from "lucide-react";

interface Ticket {
  id: string;
  ticketNumber: string;
  name: string;
  taskType: string;
  subTaskType: string;
  priority: string;
  status: string;
  dueDate: string | null;
  property: { id: string; name: string; code: string };
  unit: { id: string; name: string; code: string };
  category: { id: string; name: string };
  assignedTo: { id: string; username: string; fullName: string; role?: { name: string } } | null;
  activeBlock: { blockingUser: { fullName: string; username: string } | null; department: { name: string } | null } | null;
  completedAt: string | null;
  legacy?: boolean;
  deletedAt?: string | null;
  _count: { comments: number };
}

type View = "active" | "legacy" | "archived";

const isLate = (t: Ticket) =>
  t.status === "COMPLETED" && t.completedAt && t.dueDate && new Date(t.completedAt) > new Date(t.dueDate);

const overdueDays = (dueDate: string | null) =>
  dueDate ? Math.ceil((Date.now() - new Date(dueDate).getTime()) / 86400000) : 0;

const lateDays = (completedAt: string, dueDate: string | null) =>
  dueDate ? Math.ceil((new Date(completedAt).getTime() - new Date(dueDate).getTime()) / 86400000) : 0;

const sectionLabel = "px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400";
const radioRow = "flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[12.5px] text-gray-700 hover:bg-gray-100 transition-colors";
const radioActive = "bg-primary-50 text-primary-700 hover:bg-primary-50 font-medium";
const filterField = "px-3";
const chip = "inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700";

const STATUS_OPTIONS = [
  { value: "UNASSIGNED", label: "Unassigned" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "COMPLETED", label: "Completed" },
];
const PRIORITY_OPTIONS = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];
const TASKTYPE_OPTIONS = [
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INSPECT", label: "Inspect" },
  { value: "COMPLAIN", label: "Complain" },
  { value: "TASK", label: "Task" },
];

const csv = (arr: string[]) => arr.join(",");
const fromCsv = (s: string | null) => (s ? s.split(",").filter(Boolean) : []);

export default function TicketListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1, limit: 20 });
  const [page, setPage] = useState(1);

  // Sidebar state
  const [view, setView] = useState<View>(((searchParams.get("view") as View) || "active"));
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(fromCsv(searchParams.get("status")));
  const [overdueFilter, setOverdueFilter] = useState(searchParams.get("overdue") === "1");
  const [filters, setFilters] = useState<{
    priority: string[];
    taskType: string[];
    blocked: string;
    propertyId: string[];
    unitId: string;
    assigneeId: string;
    createdById: string;
    createdFrom: string;
    createdTo: string;
    dueDateFrom: string;
    dueDateTo: string;
  }>({
    priority: fromCsv(searchParams.get("priority")),
    taskType: fromCsv(searchParams.get("taskType")),
    blocked: "",
    propertyId: fromCsv(searchParams.get("propertyId")),
    unitId: searchParams.get("unitId") || "",
    assigneeId: "",
    createdById: "",
    createdFrom: "",
    createdTo: "",
    dueDateFrom: "",
    dueDateTo: "",
  });
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string; username: string }[]>([]);

  const [importOpen, setImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Ticket | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Ticket | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Bulk-select for reassignment
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassigning, setReassigning] = useState(false);

  const canDelete = hasPermission(PERMISSIONS.TICKETS.DELETE);
  const canAssign = hasPermission(PERMISSIONS.TICKETS.ASSIGN);

  // Fetch dropdown data once
  useEffect(() => {
    Promise.all([
      propertyApi.list({ limit: 100 }).then((r) => setProperties(r.data.data?.data || r.data.data || [])),
      userApi.list({ limit: 200 }).then((r) => setUsers(r.data.data?.data || r.data.data || [])),
    ]).catch(() => {});
  }, []);

  // Sync filters from URL when query params change (e.g. clicking dashboard chart)
  useEffect(() => {
    const v = (searchParams.get("view") as View) || "active";
    const status = fromCsv(searchParams.get("status"));
    const priority = fromCsv(searchParams.get("priority"));
    const taskType = fromCsv(searchParams.get("taskType"));
    const propertyId = fromCsv(searchParams.get("propertyId"));
    const unitId = searchParams.get("unitId") || "";
    const overdue = searchParams.get("overdue") === "1";
    setView(v);
    setStatusFilter(status);
    setOverdueFilter(overdue);
    setFilters((f) => ({ ...f, priority, taskType, propertyId, unitId }));
    setPage(1);
  }, [searchParams]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Clear bulk selection whenever the visible ticket set changes — no
  // point in keeping selections that are no longer on-screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, search, statusFilter, overdueFilter, filters, view]);

  const toggleSelectTicket = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAllVisible = (visibleTicketIds: string[]) => {
    const allSelected = visibleTicketIds.length > 0 && visibleTicketIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(visibleTicketIds));
  };
  const clearSelection = () => setSelectedIds(new Set());
  const handleBulkReassign = async () => {
    if (!reassignTo || selectedIds.size === 0) return;
    setReassigning(true);
    try {
      const res = await ticketApi.bulkAssign(Array.from(selectedIds), reassignTo);
      const { succeeded, failed } = res.data.data;
      if (failed > 0) {
        toast.error(`${succeeded} reassigned, ${failed} failed`);
      } else {
        toast.success(`${succeeded} ticket${succeeded === 1 ? "" : "s"} reassigned`);
      }
      setReassignOpen(false);
      setReassignTo("");
      clearSelection();
      fetchTickets();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to reassign");
    } finally {
      setReassigning(false);
    }
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20, sortBy, sortOrder };
      if (search) params.search = search;
      if (statusFilter.length > 0) params.status = csv(statusFilter);
      if (overdueFilter) params.overdue = "1";
      if (view === "legacy") params.legacy = "1";
      if (view === "archived") params.deleted = "1";
      for (const [k, v] of Object.entries(filters)) {
        if (Array.isArray(v)) {
          if (v.length > 0) params[k] = csv(v);
        } else if (v) {
          params[k] = v;
        }
      }
      const res = await ticketApi.list(params);
      setTickets(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, overdueFilter, filters, sortBy, sortOrder, view]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const setFilter = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const clearFilter = (key: keyof typeof filters) => {
    setFilters((f) => {
      const cur = f[key];
      return { ...f, [key]: Array.isArray(cur) ? [] : "" } as typeof f;
    });
    setPage(1);
  };

  const isFilterActive = (v: unknown) => (Array.isArray(v) ? v.length > 0 : !!v);
  const activeFilterCount =
    Object.values(filters).filter(isFilterActive).length +
    (statusFilter.length > 0 ? 1 : 0) +
    (overdueFilter ? 1 : 0) +
    (search ? 1 : 0);

  const clearAll = () => {
    setFilters({ priority: [], taskType: [], blocked: "", propertyId: [], unitId: "", assigneeId: "", createdById: "", createdFrom: "", createdTo: "", dueDateFrom: "", dueDateTo: "" });
    setStatusFilter([]);
    setOverdueFilter(false);
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const switchView = (v: View) => {
    setView(v);
    setPage(1);
    // Push view to URL so it survives reload / sharing
    const next = new URLSearchParams(searchParams);
    if (v === "active") next.delete("view"); else next.set("view", v);
    setSearchParams(next, { replace: true });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await ticketApi.softDelete(confirmDelete.id);
      toast.success(`${confirmDelete.ticketNumber} archived`);
      setConfirmDelete(null);
      fetchTickets();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to archive ticket");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!confirmRestore) return;
    setActionLoading(true);
    try {
      await ticketApi.restore(confirmRestore.id);
      toast.success(`${confirmRestore.ticketNumber} restored`);
      setConfirmRestore(null);
      fetchTickets();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to restore ticket");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSort = (column: string) => {
    if (sortBy === column) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(column); setSortOrder("asc"); }
    setPage(1);
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortBy !== column) return <ArrowUpDown size={11} className="text-gray-300" />;
    return sortOrder === "asc" ? <ChevronUp size={11} className="text-primary-600" /> : <ChevronDown size={11} className="text-primary-600" />;
  };

  const SortTh = ({ column, children }: { column: string; children: React.ReactNode }) => (
    <th onClick={() => toggleSort(column)} className={`${cls.th} cursor-pointer select-none hover:text-gray-600`}>
      <span className="inline-flex items-center gap-1">{children} <SortIcon column={column} /></span>
    </th>
  );

  // ── Sidebar component (used inline + inside mobile drawer) ────────────
  const Sidebar = useMemo(() => {
    const ViewRow = ({ value, label, icon }: { value: View; label: string; icon: React.ReactNode }) => (
      <button
        onClick={() => switchView(value)}
        className={`${radioRow} ${view === value ? radioActive : ""}`}
      >
        <span className="inline-flex items-center gap-2">{icon}{label}</span>
      </button>
    );
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3">
          <span className="text-[12px] font-semibold text-gray-800">Filters</span>
          {activeFilterCount > 0 && (
            <button onClick={clearAll} className="text-[11px] font-medium text-primary-600 hover:underline">Reset</button>
          )}
        </div>

        {/* View switcher */}
        <div className={sectionLabel}>View</div>
        <div className="px-1.5">
          <ViewRow value="active" label="Active" icon={<ClipboardList size={13} />} />
          <ViewRow value="legacy" label="Legacy" icon={<History size={13} />} />
          {canDelete && <ViewRow value="archived" label="Archived" icon={<Archive size={13} />} />}
        </div>

        {/* Status */}
        <div className={sectionLabel}>Status</div>
        <div className={filterField}>
          <MultiSelect
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            placeholder="Any status"
          />
          <button
            onClick={() => { setOverdueFilter((v) => !v); setPage(1); }}
            className={`mt-1.5 flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] ${overdueFilter ? "bg-red-50 text-red-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <span>Overdue only</span>
            {overdueFilter && <X size={11} />}
          </button>
          {/* Only show the "Assigned to me" shortcut when the user can
              actually be assigned tickets — otherwise toggling it always
              returns an empty list, which reads as a bug. */}
          {user && hasPermission(PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE) && (
            <button
              onClick={() => {
                setFilter("assigneeId", filters.assigneeId === user.id ? "" : user.id);
                setPage(1);
              }}
              className={`mt-1.5 flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] ${filters.assigneeId === user.id ? "bg-primary-50 text-primary-700 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <span>Assigned to me</span>
              {filters.assigneeId === user.id && <X size={11} />}
            </button>
          )}
        </div>

        {/* Priority */}
        <div className={sectionLabel}>Priority</div>
        <div className={filterField}>
          <MultiSelect
            options={PRIORITY_OPTIONS}
            value={filters.priority}
            onChange={(v) => setFilter("priority", v)}
            placeholder="Any priority"
          />
        </div>

        {/* Task type */}
        <div className={sectionLabel}>Task Type</div>
        <div className={filterField}>
          <MultiSelect
            options={TASKTYPE_OPTIONS}
            value={filters.taskType}
            onChange={(v) => setFilter("taskType", v)}
            placeholder="Any type"
          />
        </div>

        {/* Block status */}
        <div className={sectionLabel}>Blocker</div>
        <div className={filterField}>
          <select value={filters.blocked} onChange={(e) => setFilter("blocked", e.target.value)} className={`w-full ${cls.select} text-[12px]`}>
            <option value="">Any</option>
            <option value="yes">Has active block</option>
            <option value="no">Not blocked</option>
          </select>
        </div>

        {/* Property */}
        <div className={sectionLabel}>Property</div>
        <div className={filterField}>
          <MultiSelect
            options={properties.map((p) => ({ value: p.id, label: p.name }))}
            value={filters.propertyId}
            onChange={(v) => setFilter("propertyId", v)}
            placeholder="Any property"
            searchable
          />
        </div>

        {/* Assignee */}
        <div className={sectionLabel}>Assignee</div>
        <div className={filterField}>
          <select value={filters.assigneeId} onChange={(e) => setFilter("assigneeId", e.target.value)} className={`w-full ${cls.select} text-[12px]`}>
            <option value="">Anyone</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
          </select>
        </div>

        {/* Created by */}
        <div className={sectionLabel}>Created By</div>
        <div className={filterField}>
          <select value={filters.createdById} onChange={(e) => setFilter("createdById", e.target.value)} className={`w-full ${cls.select} text-[12px]`}>
            <option value="">Anyone</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
          </select>
        </div>

        {/* Created date */}
        <div className={sectionLabel}>Created Date</div>
        <div className={filterField}>
          <div className="flex items-center gap-1.5">
            <input type="date" value={filters.createdFrom} onChange={(e) => setFilter("createdFrom", e.target.value)} className={`min-w-0 flex-1 ${cls.input} text-[12px]`} />
            <span className="text-xs text-gray-400">–</span>
            <input type="date" value={filters.createdTo} onChange={(e) => setFilter("createdTo", e.target.value)} className={`min-w-0 flex-1 ${cls.input} text-[12px]`} />
          </div>
        </div>

        {/* Due date */}
        <div className={sectionLabel}>Due Date</div>
        <div className={`${filterField} pb-4`}>
          <div className="flex items-center gap-1.5">
            <input type="date" value={filters.dueDateFrom} onChange={(e) => setFilter("dueDateFrom", e.target.value)} className={`min-w-0 flex-1 ${cls.input} text-[12px]`} />
            <span className="text-xs text-gray-400">–</span>
            <input type="date" value={filters.dueDateTo} onChange={(e) => setFilter("dueDateTo", e.target.value)} className={`min-w-0 flex-1 ${cls.input} text-[12px]`} />
          </div>
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, statusFilter, overdueFilter, filters, properties, users, searchInput, activeFilterCount, canDelete]);

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "ticket" : "tickets"}${activeFilterCount > 0 ? " (filtered)" : ""}${view !== "active" ? ` · ${view === "legacy" ? "Legacy" : "Archived"}` : ""}`}
        actions={
          <div className="hidden sm:inline-flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name or #..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`${cls.input} w-64 pl-8 text-[13px]`}
              />
            </div>
            <button
              onClick={() => setFiltersOpen(true)}
              className={`${cls.btnSecondary} ${activeFilterCount > 0 ? "border-primary-400 bg-primary-50 text-primary-700 ring-primary-300" : ""}`}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">{activeFilterCount}</span>
              )}
            </button>
            {canAssign && selectedIds.size > 0 && (
              <>
                <button
                  onClick={() => setReassignOpen(true)}
                  className={cls.btnPrimary}
                >
                  Reassign {selectedIds.size}
                </button>
                <button onClick={clearSelection} className="text-[12px] font-medium text-gray-500 hover:text-gray-700">
                  Clear
                </button>
              </>
            )}
            {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
              <>
                <button onClick={() => setImportOpen(true)} className={cls.btnSecondary}>
                  <Upload size={16} /> Import
                </button>
                <Link to="/tickets/new" className={cls.btnPrimary}>
                  <Plus size={16} /> Create Ticket
                </Link>
              </>
            )}
          </div>
        }
      />

      {/* Mobile filter toggle */}
      <div className="mb-2 flex items-center gap-2 sm:hidden">
        <button
          onClick={() => setFiltersOpen(true)}
          className={`${cls.btnSecondary} ${activeFilterCount > 0 ? "border-primary-400 bg-primary-50 text-primary-700 ring-primary-300" : ""}`}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">{activeFilterCount}</span>
          )}
        </button>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${cls.input} pl-7`}
          />
        </div>
      </div>

      {/* Full-width content */}
      <div>
        <main className="min-w-0 flex-1">
          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {search && <span className={chip}>Search: {search}<button onClick={() => { setSearchInput(""); setSearch(""); }}><X size={10} /></button></span>}
              {statusFilter.length > 0 && <span className={chip}>Status: {statusFilter.length === 1 ? (STATUS_OPTIONS.find(o => o.value === statusFilter[0])?.label || statusFilter[0]) : `${statusFilter.length} selected`}<button onClick={() => setStatusFilter([])}><X size={10} /></button></span>}
              {overdueFilter && <span className={`${chip} bg-red-100 text-red-700`}>Overdue<button onClick={() => setOverdueFilter(false)}><X size={10} /></button></span>}
              {filters.priority.length > 0 && <span className={chip}>Priority: {filters.priority.length === 1 ? filters.priority[0] : `${filters.priority.length} selected`}<button onClick={() => clearFilter("priority")}><X size={10} /></button></span>}
              {filters.taskType.length > 0 && <span className={chip}>Type: {filters.taskType.length === 1 ? filters.taskType[0] : `${filters.taskType.length} selected`}<button onClick={() => clearFilter("taskType")}><X size={10} /></button></span>}
              {filters.blocked && <span className={`${chip} bg-orange-100 text-orange-700`}>{filters.blocked === "yes" ? "Blocked" : "Not blocked"}<button onClick={() => clearFilter("blocked")}><X size={10} /></button></span>}
              {filters.propertyId.length > 0 && <span className={chip}>Property: {filters.propertyId.length === 1 ? (properties.find(p => p.id === filters.propertyId[0])?.name || "...") : `${filters.propertyId.length} selected`}<button onClick={() => clearFilter("propertyId")}><X size={10} /></button></span>}
              {filters.unitId && <span className={chip}>Unit: {tickets.find(t => t.unit?.id === filters.unitId)?.unit?.name || tickets.find(t => t.unit?.id === filters.unitId)?.unit?.code || "…"}<button onClick={() => clearFilter("unitId")}><X size={10} /></button></span>}
              {filters.assigneeId && <span className={chip}>{filters.assigneeId === user?.id ? "Assigned to me" : `Assignee: ${users.find(u => u.id === filters.assigneeId)?.fullName || "..."}`}<button onClick={() => clearFilter("assigneeId")}><X size={10} /></button></span>}
              {filters.createdById && <span className={chip}>Created by: {users.find(u => u.id === filters.createdById)?.fullName || "..."}<button onClick={() => clearFilter("createdById")}><X size={10} /></button></span>}
              {(filters.createdFrom || filters.createdTo) && <span className={chip}>Created: {filters.createdFrom || "..."} → {filters.createdTo || "..."}<button onClick={() => { clearFilter("createdFrom"); clearFilter("createdTo"); }}><X size={10} /></button></span>}
              {(filters.dueDateFrom || filters.dueDateTo) && <span className={chip}>Due: {filters.dueDateFrom || "..."} → {filters.dueDateTo || "..."}<button onClick={() => { clearFilter("dueDateFrom"); clearFilter("dueDateTo"); }}><X size={10} /></button></span>}
            </div>
          )}

          {/* Loading / Empty / Content */}
          {loading ? (
            <TableLoading />
          ) : tickets.length === 0 ? (
            <EmptyState icon={<ClipboardList size={40} />} title="No tickets found" subtitle={view === "archived" ? "No archived tickets" : view === "legacy" ? "No legacy tickets" : "Adjust your filters or create a ticket"} />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="space-y-2 md:hidden">
                {tickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    className={`block rounded-lg p-3 ring-1 transition-colors active:bg-gray-50 ${selectedIds.has(ticket.id) ? "bg-primary-50/40 ring-primary-300" : "bg-white ring-gray-200"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {canAssign && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(ticket.id)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { e.stopPropagation(); toggleSelectTicket(ticket.id); }}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        )}
                        <span className={cls.mono}>{ticket.ticketNumber}</span>
                      </div>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-gray-900 leading-snug">{ticket.name}</p>
                    {ticket.assignedTo && <p className="mt-0.5 text-[11px] text-gray-500">{ticket.assignedTo.fullName || ticket.assignedTo.username}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <StatusBadge status={ticket.status} />
                      <UrgencyBadge urgency={computeUrgency(ticket.dueDate, ticket.status)} />
                      {isLate(ticket) && <Badge color="bg-orange-50 text-orange-600">Late</Badge>}
                      {ticket.legacy && <Badge color="bg-gray-100 text-gray-600">Legacy</Badge>}
                      {ticket.deletedAt && <Badge color="bg-red-50 text-red-600">Archived</Badge>}
                      <span className="text-[11px] text-gray-400">·</span>
                      <span className="text-[11px] text-gray-500">{TASK_TYPE_LABELS[ticket.taskType]}</span>
                      <span className="text-[11px] text-gray-400">·</span>
                      <span className="text-[11px] text-gray-500">{ticket.property.name}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">{ticket.dueDate ? `Due ${new Date(ticket.dueDate).toLocaleDateString()}` : "No due date"}</span>
                      {ticket.dueDate && computeUrgency(ticket.dueDate, ticket.status) === "OVERDUE" && <span className="text-[11px] font-semibold text-red-500">{overdueDays(ticket.dueDate)}d overdue</span>}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block rounded-lg bg-white ring-1 ring-gray-200">
                <div className="overflow-x-auto">
                  <table className={cls.table}>
                    <thead>
                      <tr className="border-b border-gray-200">
                        {canAssign && (
                          <th className="w-8 px-3 py-2">
                            <input
                              type="checkbox"
                              checked={tickets.length > 0 && tickets.every((t) => selectedIds.has(t.id))}
                              onChange={() => toggleSelectAllVisible(tickets.map((t) => t.id))}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              title="Select all on this page"
                            />
                          </th>
                        )}
                        <SortTh column="ticketNumber">#</SortTh>
                        <SortTh column="name">Name</SortTh>
                        <th className={cls.th}>Type</th>
                        <th className={cls.th}>Property</th>
                        <SortTh column="priority">Priority</SortTh>
                        <SortTh column="status">Status</SortTh>
                        <th className={cls.th}>Assigned To</th>
                        <SortTh column="dueDate">Due</SortTh>
                        <th className={cls.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className={`${cls.trClick} ${selectedIds.has(ticket.id) ? "bg-primary-50/40" : ""}`}
                        >
                          {canAssign && (
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(ticket.id)}
                                onChange={() => toggleSelectTicket(ticket.id)}
                                className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                          )}
                          <td className={cls.td}>
                            <Link to={`/tickets/${ticket.id}`} onClick={(e) => e.stopPropagation()} className={`${cls.mono} ${cls.link}`}>
                              {ticket.ticketNumber}
                            </Link>
                          </td>
                          <td className={`${cls.td} font-medium`}>
                            <Link to={`/tickets/${ticket.id}`} onClick={(e) => e.stopPropagation()} className={cls.link}>
                              {ticket.name}
                            </Link>
                            {ticket.legacy && <Badge color="bg-gray-100 text-gray-600 ml-1">Legacy</Badge>}
                            {ticket.deletedAt && <Badge color="bg-red-50 text-red-600 ml-1">Archived</Badge>}
                          </td>
                          <td className={`${cls.td} text-gray-600`}>{TASK_TYPE_LABELS[ticket.taskType]}</td>
                          <td className={cls.td}>
                            <span onClick={(e) => { e.stopPropagation(); navigate(`/properties/${ticket.property.id}`); }} className={cls.link}>{ticket.property.name}</span>
                          </td>
                          <td className={cls.td}><PriorityBadge priority={ticket.priority} /></td>
                          <td className={cls.td}>
                            <div className="flex items-center gap-1 flex-wrap">
                              <StatusBadge status={ticket.status} />
                              <UrgencyBadge urgency={computeUrgency(ticket.dueDate, ticket.status)} />
                              {isLate(ticket) && <Badge color="bg-orange-50 text-orange-600">Late</Badge>}
                            </div>
                          </td>
                          <td className={`${cls.td} text-gray-600`}>
                            {ticket.assignedTo ? (
                              <span className="text-[13px]">
                                {ticket.assignedTo.fullName || ticket.assignedTo.username}
                              </span>
                            ) : <span className="text-[11px] text-gray-400">Unassigned</span>}
                          </td>
                          <td className={cls.td}>
                            {ticket.dueDate ? (
                              <>
                                <span className="text-gray-600">{new Date(ticket.dueDate).toLocaleDateString()}</span>
                                {computeUrgency(ticket.dueDate, ticket.status) === "OVERDUE" && <p className="text-[11px] font-medium text-red-500">{overdueDays(ticket.dueDate)}d overdue</p>}
                                {isLate(ticket) && ticket.completedAt && <p className="text-[11px] font-medium text-orange-500">{lateDays(ticket.completedAt, ticket.dueDate)}d late</p>}
                              </>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={cls.td}>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Link to={`/tickets/${ticket.id}`} className={cls.btnIcon} title="View"><Eye size={15} /></Link>
                              {canDelete && view === "archived" && (
                                <button onClick={() => setConfirmRestore(ticket)} className={`${cls.btnIcon} text-emerald-600 hover:bg-emerald-50`} title="Restore"><RotateCcw size={15} /></button>
                              )}
                              {canDelete && view !== "archived" && (
                                <button onClick={() => setConfirmDelete(ticket)} className={`${cls.btnIcon} text-red-600 hover:bg-red-50`} title="Archive"><Trash2 size={15} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination pagination={pagination} onPageChange={setPage} />
              </div>

              {/* Mobile pagination — clear the FAB (4.5rem + h-14) and
                  the bulk-action bar so the prev/next controls aren't
                  hidden underneath when scrolled to the bottom. */}
              <div className="md:hidden pb-[calc(9rem+env(safe-area-inset-bottom,0px))]">
                <Pagination pagination={pagination} onPageChange={setPage} />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Filter modal */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-sidebar/50 backdrop-blur-sm animate-fade-in" onClick={() => setFiltersOpen(false)} />
          <div className="relative z-10 mx-4 w-full max-w-sm animate-scale-in rounded-lg bg-white shadow-xl ring-1 ring-gray-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-[14px] font-semibold text-gray-900">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">{Sidebar}</div>
            <div className="border-t border-gray-200 px-4 py-3">
              <button onClick={() => setFiltersOpen(false)} className={`w-full ${cls.btnPrimary} justify-center`}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
        <Link
          to="/tickets/new"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 active:bg-primary-700 transition-colors md:hidden"
        >
          <Plus size={24} />
        </Link>
      )}

      <BulkImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Tickets"
        columns={[
          { key: "title", label: "Title", required: true, example: "Replace AC filter" },
          { key: "description", label: "Description", required: true, example: "Filter clogged in conf room" },
          { key: "property", label: "Property", required: true, example: "Vogue", aliases: ["propertyName", "propertyCode"] },
          { key: "unit", label: "Unit", example: "101", aliases: ["unitName"] },
          { key: "department", label: "Department", example: "Facility Management" },
          { key: "category", label: "Category", example: "HVAC" },
          { key: "taskType", label: "Task Type", example: "Maintenance" },
          { key: "subTaskType", label: "Sub Task Type", example: "Reactive" },
          { key: "priority", label: "Priority", example: "Medium" },
          { key: "dueDate", label: "Due Date", example: "2026-04-15" },
          { key: "assigneeEmail", label: "Assignee Email", example: "tech@example.com", aliases: ["assignee"] },
        ]}
        onImport={async (items) => {
          const res = await ticketApi.bulkImport(items);
          return res.data.data;
        }}
        onComplete={() => fetchTickets()}
      />

      {/* Confirm archive */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Archive ticket">
        <p className="text-[13px] text-gray-600">
          Archive <span className="font-semibold">{confirmDelete?.ticketNumber}</span> — {confirmDelete?.name}? It will be hidden from active views and reports but can be restored from the Archived view.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirmDelete(null)} className={cls.btnSecondary} disabled={actionLoading}>Cancel</button>
          <button onClick={handleDelete} className={`${cls.btnPrimary} bg-red-600 hover:bg-red-700`} disabled={actionLoading}>
            {actionLoading ? "Archiving..." : "Archive"}
          </button>
        </div>
      </Modal>

      {/* Confirm restore */}
      <Modal isOpen={!!confirmRestore} onClose={() => setConfirmRestore(null)} title="Restore ticket">
        <p className="text-[13px] text-gray-600">
          Restore <span className="font-semibold">{confirmRestore?.ticketNumber}</span> — {confirmRestore?.name}? It will reappear in the active list.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirmRestore(null)} className={cls.btnSecondary} disabled={actionLoading}>Cancel</button>
          <button onClick={handleRestore} className={cls.btnPrimary} disabled={actionLoading}>
            {actionLoading ? "Restoring..." : "Restore"}
          </button>
        </div>
      </Modal>

      {/* Mobile-only bulk action bar. Desktop shows the Reassign button
          inline in the PageHeader actions row. */}
      {canAssign && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-lg sm:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-[13px] font-medium text-gray-800">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button onClick={clearSelection} className="text-[12px] font-medium text-gray-500 hover:text-gray-700">
                Clear
              </button>
              <button
                onClick={() => setReassignOpen(true)}
                className={cls.btnPrimary}
              >
                Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign modal */}
      <Modal isOpen={reassignOpen} onClose={() => { if (!reassigning) { setReassignOpen(false); setReassignTo(""); } }} title={`Reassign ${selectedIds.size} ticket${selectedIds.size === 1 ? "" : "s"}`}>
        <div className="space-y-3">
          <div>
            <label className={cls.label}>Assign to <span className="text-red-500">*</span></label>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className={`w-full ${cls.select}`}
              disabled={reassigning}
              autoFocus
            >
              <option value="">Select a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.fullName || u.username}</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Assignment is validated per-ticket. Any that can't be reassigned (e.g., the new user lacks access to the property) will report a failure at the end.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setReassignOpen(false); setReassignTo(""); }}
              className={cls.btnSecondary}
              disabled={reassigning}
            >
              Cancel
            </button>
            <button
              onClick={handleBulkReassign}
              className={cls.btnPrimary}
              disabled={!reassignTo || reassigning}
            >
              {reassigning ? "Reassigning..." : `Reassign ${selectedIds.size}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
