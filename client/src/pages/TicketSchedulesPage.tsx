import { useState, useEffect, useCallback } from "react";
import { ticketScheduleApi, propertyApi, unitApi, ticketCategoryApi, departmentApi, userApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { TASK_TYPE_LABELS, PRIORITY_LABELS } from "../../../shared/types";
import { cls } from "../lib/styles";
import { PriorityBadge, Badge } from "../components/ui/Badge";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import { Plus, CalendarClock, Pencil, Trash2, X } from "lucide-react";

// ── Constants ──

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const DAY_OF_WEEK_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const FREQUENCY_COLOR: Record<string, string> = {
  DAILY: "bg-violet-50 text-violet-700",
  WEEKLY: "bg-blue-50 text-blue-700",
  MONTHLY: "bg-cyan-50 text-cyan-700",
  QUARTERLY: "bg-teal-50 text-teal-700",
  YEARLY: "bg-emerald-50 text-emerald-700",
};

// ── Types ──

interface TicketSchedule {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  priority: string;
  taskType: string;
  subTaskType: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  property: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  assignedTo: { id: string; fullName: string; username: string } | null;
}

interface FormData {
  name: string;
  description: string;
  propertyId: string;
  unitId: string;
  categoryId: string;
  departmentId: string;
  assignedToId: string;
  priority: string;
  taskType: string;
  subTaskType: string;
  frequency: string;
  dayOfWeek: string;
  dayOfMonth: string;
  monthOfYear: string;
}

const emptyForm: FormData = {
  name: "",
  description: "",
  propertyId: "",
  unitId: "",
  categoryId: "",
  departmentId: "",
  assignedToId: "",
  priority: "MEDIUM",
  taskType: "MAINTENANCE",
  subTaskType: "PREVENTIVE",
  frequency: "MONTHLY",
  dayOfWeek: "",
  dayOfMonth: "1",
  monthOfYear: "1",
};

export default function TicketSchedulesPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();

  // ── List state ──
  const [schedules, setSchedules] = useState<TicketSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1, limit: 10 });

  // ── Modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // ── Delete confirmation ──
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Lookup data ──
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string; username: string }[]>([]);
  const [lookupsLoaded, setLookupsLoaded] = useState(false);

  // ── Fetch schedules ──
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ticketScheduleApi.list({ page, limit: 10 });
      const data = res.data.data;
      setSchedules(data.data || data);
      if (data.pagination) setPagination(data.pagination);
    } catch {
      toast.error("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  // ── Load lookups when modal opens ──
  useEffect(() => {
    if (!modalOpen || lookupsLoaded) return;
    Promise.all([
      propertyApi.list({ limit: 100 }).then((r) => setProperties(r.data.data?.data || r.data.data || [])),
      ticketCategoryApi.list().then((r) => setCategories(r.data.data?.data || r.data.data || [])),
      departmentApi.list().then((r) => setDepartments(r.data.data?.data || r.data.data || [])),
      userApi.list({ limit: 200 }).then((r) => setUsers(r.data.data?.data || r.data.data || [])),
    ]).then(() => setLookupsLoaded(true)).catch(() => {});
  }, [modalOpen, lookupsLoaded]);

  // ── Load units when property changes ──
  useEffect(() => {
    if (!form.propertyId) { setUnits([]); return; }
    unitApi.list(form.propertyId).then((r) => setUnits(r.data.data?.data || r.data.data || [])).catch(() => setUnits([]));
  }, [form.propertyId]);

  // ── Helpers ──
  const setField = (key: keyof FormData, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (schedule: TicketSchedule) => {
    setEditingId(schedule.id);
    setForm({
      name: schedule.name,
      description: schedule.description || "",
      propertyId: schedule.property?.id || "",
      unitId: schedule.unit?.id || "",
      categoryId: schedule.category?.id || "",
      departmentId: schedule.department?.id || "",
      assignedToId: schedule.assignedTo?.id || "",
      priority: schedule.priority,
      taskType: schedule.taskType,
      subTaskType: schedule.subTaskType,
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek != null ? String(schedule.dayOfWeek) : "",
      dayOfMonth: schedule.dayOfMonth != null ? String(schedule.dayOfMonth) : "1",
      monthOfYear: schedule.monthOfYear != null ? String(schedule.monthOfYear) : "1",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.propertyId) { toast.error("Property is required"); return; }
    if (!form.frequency) { toast.error("Frequency is required"); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        propertyId: form.propertyId,
        unitId: form.unitId || null,
        categoryId: form.categoryId || null,
        departmentId: form.departmentId || null,
        assignedToId: form.assignedToId || null,
        priority: form.priority,
        taskType: form.taskType,
        subTaskType: form.subTaskType,
        frequency: form.frequency,
      };

      if (form.frequency === "WEEKLY") {
        payload.dayOfWeek = form.dayOfWeek ? Number(form.dayOfWeek) : null;
      }
      if (["MONTHLY", "QUARTERLY", "YEARLY"].includes(form.frequency)) {
        payload.dayOfMonth = form.dayOfMonth ? Number(form.dayOfMonth) : null;
      }
      if (["QUARTERLY", "YEARLY"].includes(form.frequency)) {
        payload.monthOfYear = form.monthOfYear ? Number(form.monthOfYear) : null;
      }

      if (editingId) {
        await ticketScheduleApi.update(editingId, payload);
        toast.success("Schedule updated");
      } else {
        await ticketScheduleApi.create(payload);
        toast.success("Schedule created");
      }
      setModalOpen(false);
      fetchSchedules();
    } catch {
      toast.error(editingId ? "Failed to update schedule" : "Failed to create schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await ticketScheduleApi.remove(deleteId);
      toast.success("Schedule deleted");
      setDeleteId(null);
      fetchSchedules();
    } catch {
      toast.error("Failed to delete schedule");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await ticketScheduleApi.toggle(id);
      fetchSchedules();
    } catch {
      toast.error("Failed to toggle schedule");
    }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : "-";

  const showDayOfWeek = form.frequency === "WEEKLY";
  const showDayOfMonth = ["MONTHLY", "QUARTERLY", "YEARLY"].includes(form.frequency);
  const showMonthOfYear = ["QUARTERLY", "YEARLY"].includes(form.frequency);

  return (
    <div>
      <PageHeader
        title="Ticket Schedules"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "schedule" : "schedules"} total`}
        actions={
          hasPermission(PERMISSIONS.TICKETS.CREATE) ? (
            <button onClick={openCreate} className={`hidden sm:inline-flex ${cls.btnPrimary}`}>
              <Plus size={16} /> Create Schedule
            </button>
          ) : undefined
        }
      />

      {/* Loading / Empty / Content */}
      {loading ? (
        <TableLoading />
      ) : schedules.length === 0 ? (
        <EmptyState icon={<CalendarClock size={40} />} title="No schedules found" subtitle="Create a recurring ticket schedule to automate ticket creation" />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-2 md:hidden">
            {schedules.map((s) => (
              <div key={s.id} className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-gray-900">{s.name}</span>
                  <PriorityBadge priority={s.priority} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <Badge color={FREQUENCY_COLOR[s.frequency] || "bg-gray-100 text-gray-600"}>
                    {FREQUENCY_LABELS[s.frequency] || s.frequency}
                  </Badge>
                  <Badge color={s.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}>
                    {s.isActive ? "Active" : "Inactive"}
                  </Badge>
                  {s.property && <span className="text-[11px] text-gray-500">{s.property.name}</span>}
                </div>
                {s.assignedTo && <p className="mt-1 text-[11px] text-gray-500">{s.assignedTo.fullName || s.assignedTo.username}</p>}
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Next: {formatDate(s.nextRunAt)}</span>
                  <span>Last: {formatDate(s.lastRunAt)}</span>
                </div>
                {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
                  <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
                    <button onClick={() => handleToggle(s.id)} className={`text-[12px] font-medium ${s.isActive ? "text-amber-600" : "text-emerald-600"}`}>
                      {s.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => openEdit(s)} className="text-[12px] font-medium text-primary-600">Edit</button>
                    <button onClick={() => setDeleteId(s.id)} className="text-[12px] font-medium text-red-600">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-lg bg-white ring-1 ring-gray-200">
            <div className="overflow-x-auto">
              <table className={cls.table}>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={cls.th}>Name</th>
                    <th className={cls.th}>Property</th>
                    <th className={cls.th}>Frequency</th>
                    <th className={cls.th}>Next Run</th>
                    <th className={cls.th}>Last Run</th>
                    <th className={cls.th}>Assignee</th>
                    <th className={cls.th}>Priority</th>
                    <th className={cls.th}>Active</th>
                    <th className={cls.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.id} className={cls.tr}>
                      <td className={`${cls.td} font-medium text-gray-900`}>{s.name}</td>
                      <td className={`${cls.td} text-gray-600`}>{s.property?.name || "-"}</td>
                      <td className={cls.td}>
                        <Badge color={FREQUENCY_COLOR[s.frequency] || "bg-gray-100 text-gray-600"}>
                          {FREQUENCY_LABELS[s.frequency] || s.frequency}
                        </Badge>
                      </td>
                      <td className={`${cls.td} text-gray-600`}>{formatDate(s.nextRunAt)}</td>
                      <td className={`${cls.td} text-gray-600`}>{formatDate(s.lastRunAt)}</td>
                      <td className={`${cls.td} text-gray-600`}>
                        {s.assignedTo ? (s.assignedTo.fullName || s.assignedTo.username) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className={cls.td}><PriorityBadge priority={s.priority} /></td>
                      <td className={cls.td}>
                        <button
                          onClick={() => handleToggle(s.id)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.isActive ? "bg-emerald-500" : "bg-gray-300"}`}
                          title={s.isActive ? "Click to deactivate" : "Click to activate"}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${s.isActive ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                        </button>
                      </td>
                      <td className={cls.td}>
                        {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(s)} className={cls.btnIcon} title="Edit">
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => setDeleteId(s.id)} className={`${cls.btnIcon} hover:text-red-600`} title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
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
        <button
          onClick={openCreate}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 active:bg-primary-700 transition-colors md:hidden"
        >
          <Plus size={24} />
        </button>
      )}

      {/* ── Create/Edit Modal ── */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]">
            <div className="relative w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-gray-900">
                  {editingId ? "Edit Schedule" : "Create Schedule"}
                </h2>
                <button onClick={() => setModalOpen(false)} className={cls.btnIcon}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {/* Name */}
                <div>
                  <label className={cls.label}>Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className={cls.input}
                    placeholder="e.g. Weekly AC Filter Inspection"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={cls.label}>Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    className={cls.textarea}
                    rows={2}
                    placeholder="Optional description..."
                  />
                </div>

                {/* Property + Unit */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cls.label}>Property *</label>
                    <select value={form.propertyId} onChange={(e) => { setField("propertyId", e.target.value); setField("unitId", ""); }} className={`w-full ${cls.select}`}>
                      <option value="">Select property</option>
                      {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={cls.label}>Unit</label>
                    <select value={form.unitId} onChange={(e) => setField("unitId", e.target.value)} className={`w-full ${cls.select}`} disabled={!form.propertyId}>
                      <option value="">Select unit</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Category + Department */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={cls.label}>Category</label>
                    <select value={form.categoryId} onChange={(e) => setField("categoryId", e.target.value)} className={`w-full ${cls.select}`}>
                      <option value="">Select category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={cls.label}>Department</label>
                    <select value={form.departmentId} onChange={(e) => setField("departmentId", e.target.value)} className={`w-full ${cls.select}`}>
                      <option value="">Select department</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Assignee */}
                <div>
                  <label className={cls.label}>Assignee</label>
                  <select value={form.assignedToId} onChange={(e) => setField("assignedToId", e.target.value)} className={`w-full ${cls.select}`}>
                    <option value="">Select assignee</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
                  </select>
                </div>

                {/* Priority + Task Type + Sub Task Type */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={cls.label}>Priority</label>
                    <select value={form.priority} onChange={(e) => setField("priority", e.target.value)} className={`w-full ${cls.select}`}>
                      {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={cls.label}>Task Type</label>
                    <select value={form.taskType} onChange={(e) => setField("taskType", e.target.value)} className={`w-full ${cls.select}`}>
                      {Object.entries(TASK_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={cls.label}>Sub Type</label>
                    <select value={form.subTaskType} onChange={(e) => setField("subTaskType", e.target.value)} className={`w-full ${cls.select}`}>
                      <option value="PREVENTIVE">Preventive</option>
                      <option value="REACTIVE">Reactive</option>
                    </select>
                  </div>
                </div>

                {/* Frequency */}
                <div>
                  <label className={cls.label}>Frequency *</label>
                  <select value={form.frequency} onChange={(e) => setField("frequency", e.target.value)} className={`w-full ${cls.select}`}>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                {/* Conditional frequency fields */}
                <div className="grid grid-cols-3 gap-3">
                  {showDayOfWeek && (
                    <div>
                      <label className={cls.label}>Day of Week</label>
                      <select value={form.dayOfWeek} onChange={(e) => setField("dayOfWeek", e.target.value)} className={`w-full ${cls.select}`}>
                        <option value="">Select day</option>
                        {Object.entries(DAY_OF_WEEK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  )}
                  {showDayOfMonth && (
                    <div>
                      <label className={cls.label}>Day of Month</label>
                      <select value={form.dayOfMonth} onChange={(e) => setField("dayOfMonth", e.target.value)} className={`w-full ${cls.select}`}>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                  {showMonthOfYear && (
                    <div>
                      <label className={cls.label}>Month</label>
                      <select value={form.monthOfYear} onChange={(e) => setField("monthOfYear", e.target.value)} className={`w-full ${cls.select}`}>
                        {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                          <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => setModalOpen(false)} className={cls.btnSecondary}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className={cls.btnPrimary}>
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Confirmation ── */}
      {deleteId && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-semibold text-gray-900">Delete Schedule</h3>
              <p className="mt-2 text-[13px] text-gray-600">
                Are you sure you want to delete this schedule? This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setDeleteId(null)} className={cls.btnSecondary}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className={cls.btnDanger}>
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
