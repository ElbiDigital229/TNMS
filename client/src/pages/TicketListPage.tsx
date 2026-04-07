import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ticketApi, propertyApi, userApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { TASK_TYPE_LABELS, PRIORITY_LABELS, TICKET_STATUS_LABELS, computeUrgency } from "../../../shared/types";
import { cls } from "../lib/styles";
import { StatusBadge, PriorityBadge, UrgencyBadge, Badge } from "../components/ui/Badge";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import BulkImportModal from "../components/ui/BulkImportModal";
import {
  Plus, Search, Eye, ChevronUp, ChevronDown,
  ClipboardList, SlidersHorizontal, X, ArrowUpDown, Upload,
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
  _count: { comments: number };
}

const isLate = (t: Ticket) =>
  t.status === "COMPLETED" && t.completedAt && t.dueDate && new Date(t.completedAt) > new Date(t.dueDate);

const overdueDays = (dueDate: string | null) =>
  dueDate ? Math.ceil((Date.now() - new Date(dueDate).getTime()) / 86400000) : 0;

const lateDays = (completedAt: string, dueDate: string | null) =>
  dueDate ? Math.ceil((new Date(completedAt).getTime() - new Date(dueDate).getTime()) / 86400000) : 0;

const filterLabel = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500";
const chip = "inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700";

export default function TicketListPage() {
  const navigate = useNavigate();
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
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [importOpen, setImportOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState({
    priority: "", taskType: "", blocked: "", propertyId: "",
    assigneeId: "", createdById: "", createdFrom: "", createdTo: "",
    dueDateFrom: "", dueDateTo: "",
  });
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string; username: string }[]>([]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
  const clearAll = () => {
    setFilters({ priority: "", taskType: "", blocked: "", propertyId: "", assigneeId: "", createdById: "", createdFrom: "", createdTo: "", dueDateFrom: "", dueDateTo: "" });
    setPage(1);
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10, sortBy, sortOrder };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      for (const [k, v] of Object.entries(filters)) { if (v) params[k] = v; }
      const res = await ticketApi.list(params);
      setTickets(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, filters, sortBy, sortOrder]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => {
    const timeout = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

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

  const FilterSelect = ({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
    <div>
      <label className={filterLabel}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full ${cls.select}`}>{children}</select>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Tickets"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "ticket" : "tickets"} total`}
        actions={
          hasPermission(PERMISSIONS.TICKETS.CREATE) ? (
            <div className="hidden sm:inline-flex gap-2">
              <button onClick={() => setImportOpen(true)} className={cls.btnSecondary}>
                <Upload size={16} /> Import
              </button>
              <Link to="/tickets/new" className={cls.btnPrimary}>
                <Plus size={16} /> Create Ticket
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* Search + Filters */}
      <div className="mb-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or ticket #..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`${cls.input} pl-8`}
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`${cls.btnSecondary} ${activeFilterCount > 0 ? "border-primary-400 bg-primary-50 text-primary-700 ring-primary-300" : ""}`}
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-semibold text-white">{activeFilterCount}</span>
              )}
            </button>

            {filterOpen && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setFilterOpen(false)} />}
            {filterOpen && (
              <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white p-3 shadow-xl animate-slide-up md:absolute md:inset-auto md:right-0 md:top-full md:z-50 md:mt-1.5 md:w-72 md:max-h-[70vh] md:rounded-lg md:border md:border-gray-200 md:shadow-lg md:animate-none"
                   style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-800">Filters</span>
                  {activeFilterCount > 0 && <button onClick={clearAll} className="text-xs text-primary-600 hover:underline">Clear all</button>}
                </div>
                <div className="space-y-2.5">
                  <FilterSelect label="Priority" value={filters.priority} onChange={(v) => setFilter("priority", v)}>
                    <option value="">Any</option>
                    <option value="CRITICAL">Critical</option><option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                  </FilterSelect>
                  <FilterSelect label="Task Type" value={filters.taskType} onChange={(v) => setFilter("taskType", v)}>
                    <option value="">Any</option>
                    <option value="COMPLAIN">Complain</option><option value="MAINTENANCE">Maintenance</option>
                    <option value="INSPECT">Inspect</option><option value="TASK">Task</option>
                  </FilterSelect>
                  <FilterSelect label="Block Status" value={filters.blocked} onChange={(v) => setFilter("blocked", v)}>
                    <option value="">All</option><option value="yes">Blocked</option><option value="no">Not blocked</option>
                  </FilterSelect>
                  <FilterSelect label="Property" value={filters.propertyId} onChange={(v) => setFilter("propertyId", v)}>
                    <option value="">Any</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </FilterSelect>
                  <FilterSelect label="Assignee" value={filters.assigneeId} onChange={(v) => setFilter("assigneeId", v)}>
                    <option value="">Anyone</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
                  </FilterSelect>
                  <FilterSelect label="Created By" value={filters.createdById} onChange={(v) => setFilter("createdById", v)}>
                    <option value="">Anyone</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
                  </FilterSelect>
                  <div>
                    <label className={filterLabel}>Created Date</label>
                    <div className="flex gap-1.5">
                      <input type="date" value={filters.createdFrom} onChange={(e) => setFilter("createdFrom", e.target.value)} className={cls.input} />
                      <input type="date" value={filters.createdTo} onChange={(e) => setFilter("createdTo", e.target.value)} className={cls.input} />
                    </div>
                  </div>
                  <div>
                    <label className={filterLabel}>Due Date</label>
                    <div className="flex gap-1.5">
                      <input type="date" value={filters.dueDateFrom} onChange={(e) => setFilter("dueDateFrom", e.target.value)} className={cls.input} />
                      <input type="date" value={filters.dueDateTo} onChange={(e) => setFilter("dueDateTo", e.target.value)} className={cls.input} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 md:hidden">
                  {activeFilterCount > 0 && (
                    <button onClick={() => { clearAll(); setFilterOpen(false); }} className={`flex-1 ${cls.btnSecondary} justify-center`}>Reset</button>
                  )}
                  <button onClick={() => setFilterOpen(false)} className={`flex-1 ${cls.btnPrimary} justify-center`}>Apply Filters</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status quick pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          {[["", "All"], ["UNASSIGNED", "Unassigned"], ["ASSIGNED", "Assigned"], ["IN_PROGRESS", "In Progress"], ["BLOCKED", "Blocked"], ["COMPLETED", "Completed"]].map(([val, label]) => (
            <button
              key={val}
              onClick={() => { setStatusFilter(val); setPage(1); }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${statusFilter === val ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1">
            {filters.priority && <span className={chip}>Priority: {filters.priority}<button onClick={() => clearFilter("priority")}><X size={10} /></button></span>}
            {filters.taskType && <span className={chip}>Type: {filters.taskType}<button onClick={() => clearFilter("taskType")}><X size={10} /></button></span>}
            {filters.blocked && <span className={`${chip} bg-orange-100 text-orange-700`}>{filters.blocked === "yes" ? "Blocked" : "Not blocked"}<button onClick={() => clearFilter("blocked")}><X size={10} /></button></span>}
            {filters.propertyId && <span className={chip}>Property: {properties.find(p => p.id === filters.propertyId)?.name || "..."}<button onClick={() => clearFilter("propertyId")}><X size={10} /></button></span>}
            {filters.assigneeId && <span className={chip}>Assignee: {users.find(u => u.id === filters.assigneeId)?.fullName || "..."}<button onClick={() => clearFilter("assigneeId")}><X size={10} /></button></span>}
            {filters.createdById && <span className={chip}>Created by: {users.find(u => u.id === filters.createdById)?.fullName || "..."}<button onClick={() => clearFilter("createdById")}><X size={10} /></button></span>}
            {(filters.createdFrom || filters.createdTo) && <span className={chip}>Created: {filters.createdFrom || "..."} - {filters.createdTo || "..."}<button onClick={() => { clearFilter("createdFrom"); clearFilter("createdTo"); }}><X size={10} /></button></span>}
            {(filters.dueDateFrom || filters.dueDateTo) && <span className={chip}>Due: {filters.dueDateFrom || "..."} - {filters.dueDateTo || "..."}<button onClick={() => { clearFilter("dueDateFrom"); clearFilter("dueDateTo"); }}><X size={10} /></button></span>}
          </div>
        )}
      </div>

      {/* Loading / Empty / Content */}
      {loading ? (
        <TableLoading />
      ) : tickets.length === 0 ? (
        <EmptyState icon={<ClipboardList size={40} />} title="No tickets found" subtitle="Create your first ticket to start tracking" />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-2 md:hidden">
            {tickets.map((ticket) => (
              <Link key={ticket.id} to={`/tickets/${ticket.id}`} className="block rounded-lg bg-white p-3 ring-1 ring-gray-200 active:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className={cls.mono}>{ticket.ticketNumber}</span>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <p className="mt-1 text-[13px] font-semibold text-gray-900 leading-snug">{ticket.name}</p>
                {ticket.assignedTo && <p className="mt-0.5 text-[11px] text-gray-500">{ticket.assignedTo.fullName || ticket.assignedTo.username}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <StatusBadge status={ticket.status} />
                  <UrgencyBadge urgency={computeUrgency(ticket.dueDate, ticket.status)} />
                  {isLate(ticket) && <Badge color="bg-orange-50 text-orange-600">Late</Badge>}
                  <span className="text-[11px] text-gray-400">-</span>
                  <span className="text-[11px] text-gray-500">{TASK_TYPE_LABELS[ticket.taskType]}</span>
                  <span className="text-[11px] text-gray-400">-</span>
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
                    <SortTh column="ticketNumber">Ticket #</SortTh>
                    <SortTh column="name">Name</SortTh>
                    <th className={cls.th}>Type</th>
                    <th className={cls.th}>Property</th>
                    <SortTh column="priority">Priority</SortTh>
                    <SortTh column="status">Status</SortTh>
                    <th className={cls.th}>Block</th>
                    <th className={cls.th}>Assigned To</th>
                    <SortTh column="dueDate">Due Date</SortTh>
                    <th className={cls.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} className={cls.trClick}>
                      <td className={`${cls.td} ${cls.mono}`}>{ticket.ticketNumber}</td>
                      <td className={`${cls.td} font-medium text-gray-900`}>{ticket.name}</td>
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
                      <td className={cls.td}>
                        {ticket.activeBlock ? (
                          <div>
                            <Badge color="bg-orange-100 text-orange-700">Blocked</Badge>
                            <p className="mt-0.5 text-[11px] text-gray-500">
                              {ticket.activeBlock.blockingUser
                                ? ticket.activeBlock.blockingUser.fullName || ticket.activeBlock.blockingUser.username
                                : ticket.activeBlock.department?.name}
                            </p>
                          </div>
                        ) : <span className="text-[11px] text-gray-300">-</span>}
                      </td>
                      <td className={`${cls.td} text-gray-600`}>
                        {ticket.assignedTo ? (
                          <span className="text-[13px]">
                            {ticket.assignedTo.fullName || ticket.assignedTo.username}
                            {ticket.assignedTo.role && <span className="ml-1 text-[11px] text-gray-400">({ticket.assignedTo.role.name})</span>}
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
                        <span className={cls.btnIcon} title="View"><Eye size={15} /></span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>

          {/* Mobile pagination */}
          <div className="md:hidden">
            <Pagination pagination={pagination} onPageChange={setPage} />
          </div>
        </>
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
    </div>
  );
}
