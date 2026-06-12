import { useState, useEffect, useCallback } from "react";
import { acquisitionAgentApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { cls, STATUS_COLOR } from "../lib/styles";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import BulkImportModal from "../components/ui/BulkImportModal";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RotateCcw,
  Star,
  Handshake,
  Download,
  Upload,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────
interface Agent {
  id: string;
  agentCode: string;
  agentName: string;
  companyName: string | null;
  contactNumber: string;
  email: string | null;
  city: string;
  areaFocus: string | null;
  sourceType: "BROKER" | "OWNER" | "CONSULTANT";
  rating: number;
  firstContactDate: string | null;
  status: "ACTIVE" | "INACTIVE";
  lastAvailabilityCheck: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  activeDeals: number;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  BROKER: "Broker",
  OWNER: "Owner",
  CONSULTANT: "Consultant",
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  BROKER: "bg-blue-50 text-blue-700",
  OWNER: "bg-emerald-50 text-emerald-700",
  CONSULTANT: "bg-violet-50 text-violet-700",
};

const emptyForm = {
  agentName: "",
  companyName: "",
  contactNumber: "",
  email: "",
  city: "",
  areaFocus: "",
  sourceType: "BROKER",
  rating: 3,
  firstContactDate: "",
  status: "ACTIVE",
  lastAvailabilityCheck: "",
  notes: "",
};

// ─── Mini star-rating input ───────────────────────────────────────────────
function StarRating({ value, onChange, readOnly = false, size = 16 }: {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"}
          title={`${n} of 5`}
        >
          <Star
            size={size}
            className={n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300"}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AcquisitionAgentsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.ACQUISITIONS.CREATE);
  const canEdit = hasPermission(PERMISSIONS.ACQUISITIONS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.ACQUISITIONS.DELETE);
  const canImport = hasPermission(PERMISSIONS.ACQUISITIONS.IMPORT);
  const canExport = hasPermission(PERMISSIONS.ACQUISITIONS.EXPORT);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1, limit: 25 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [confirmArchive, setConfirmArchive] = useState<Agent | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { page, limit: 25 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.sourceType = sourceFilter;
      if (cityFilter) params.city = cityFilter;
      if (includeDeleted) params.includeDeleted = true;
      const res = await acquisitionAgentApi.list(params);
      setAgents(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceFilter, cityFilter, includeDeleted, toast]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (a: Agent) => {
    setEditing(a);
    setForm({
      agentName: a.agentName,
      companyName: a.companyName || "",
      contactNumber: a.contactNumber,
      email: a.email || "",
      city: a.city,
      areaFocus: a.areaFocus || "",
      sourceType: a.sourceType,
      rating: a.rating,
      firstContactDate: a.firstContactDate ? a.firstContactDate.slice(0, 10) : "",
      status: a.status,
      lastAvailabilityCheck: a.lastAvailabilityCheck ? a.lastAvailabilityCheck.slice(0, 10) : "",
      notes: a.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); };
  const updateForm = (k: keyof typeof emptyForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.agentName.trim()) return toast.error("Agent name is required");
    if (!form.contactNumber.trim()) return toast.error("Contact number is required");
    if (!form.city.trim()) return toast.error("City is required");

    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) await acquisitionAgentApi.update(editing.id, payload);
      else await acquisitionAgentApi.create(payload);
      toast.success(editing ? "Agent updated" : "Agent created");
      closeModal();
      fetchAgents();
    } catch (err: any) {
      const data = err.response?.data;
      let msg = data?.error || "Failed to save agent";
      if (Array.isArray(data?.details) && data.details.length > 0) {
        msg = `${msg} — ${data.details.map((d: any) => `${d.path}: ${d.message}`).join("; ")}`;
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (a: Agent) => {
    try {
      await acquisitionAgentApi.remove(a.id);
      toast.success("Agent archived");
      setConfirmArchive(null);
      fetchAgents();
    } catch {
      toast.error("Failed to archive agent");
    }
  };

  const handleRestore = async (a: Agent) => {
    try {
      await acquisitionAgentApi.restore(a.id);
      toast.success("Agent restored");
      fetchAgents();
    } catch {
      toast.error("Failed to restore agent");
    }
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (sourceFilter) params.sourceType = sourceFilter;
    if (cityFilter) params.city = cityFilter;
    const url = acquisitionAgentApi.exportUrl(params);
    // Use a token-aware fetch so the auth header passes through, then trigger download
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `acquisition-agents-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Failed to export"));
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB") : "—";

  return (
    <div>
      <PageHeader
        title="Acquisition Agents"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "agent" : "agents"} total`}
        actions={
          <>
            {canExport && (
              <button onClick={handleExport} className={cls.btnSecondary}>
                <Download size={14} /> Export
              </button>
            )}
            {canImport && (
              <button onClick={() => setImportOpen(true)} className={cls.btnSecondary}>
                <Upload size={14} /> Import
              </button>
            )}
            {canCreate && (
              <button onClick={openCreate} className={cls.btnPrimary}>
                <Plus size={14} /> Add Agent
              </button>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search code, name, company, phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${cls.input} pl-8`}
          />
        </div>
        <select value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Source Types</option>
          <option value="BROKER">Broker</option>
          <option value="OWNER">Owner</option>
          <option value="CONSULTANT">Consultant</option>
        </select>
        <input
          type="text"
          placeholder="City…"
          value={cityFilter}
          onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
          className={cls.input}
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <label className="inline-flex items-center gap-2 text-[12px] text-gray-600">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1); }}
            className="rounded border-gray-300"
          />
          Show archived
        </label>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>Code</th>
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Company</th>
                <th className={cls.th}>Source</th>
                <th className={cls.th}>Phone</th>
                <th className={cls.th}>City</th>
                <th className={cls.th}>Rating</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Active Deals</th>
                <th className={cls.th}>Last Updated</th>
                <th className={cls.th + " text-right"}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11}><TableLoading /></td></tr>
              ) : agents.length === 0 ? (
                <tr><td colSpan={11}>
                  <EmptyState
                    icon={<Handshake size={48} />}
                    title="No agents found"
                    subtitle="Try adjusting your search or add a new agent"
                  />
                </td></tr>
              ) : (
                agents.map((a) => (
                  <tr key={a.id} onClick={() => openEdit(a)} className={cls.trClick}>
                    <td className={`px-3 py-2 ${cls.mono}`}>{a.agentCode}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{a.agentName}</td>
                    <td className="px-3 py-2 text-gray-600">{a.companyName || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${SOURCE_TYPE_COLORS[a.sourceType]}`}>
                        {SOURCE_TYPE_LABELS[a.sourceType]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{a.contactNumber}</td>
                    <td className="px-3 py-2 text-gray-600">{a.city}</td>
                    <td className="px-3 py-2"><StarRating value={a.rating} readOnly size={13} /></td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[a.status]}`}>
                        {a.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                      {a.deletedAt && (
                        <span className="ml-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-gray-900">{a.activeDeals}</td>
                    <td className="px-3 py-2 text-gray-500 text-[12px]">{fmtDate(a.updatedAt)}</td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <button onClick={() => openEdit(a)} className={cls.btnIcon} title="Edit">
                            <Pencil size={14} />
                          </button>
                        )}
                        {canDelete && !a.deletedAt && (
                          <button onClick={() => setConfirmArchive(a)} className={cls.btnIcon} title="Archive">
                            <Trash2 size={14} className="text-red-600" />
                          </button>
                        )}
                        {canDelete && a.deletedAt && (
                          <button onClick={() => handleRestore(a)} className={cls.btnIcon} title="Restore">
                            <RotateCcw size={14} className="text-emerald-600" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

      {/* Form modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.agentCode}` : "Add Agent"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={cls.label}>Agent Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.agentName} onChange={(e) => updateForm("agentName", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Company Name</label>
            <input type="text" value={form.companyName} onChange={(e) => updateForm("companyName", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Contact Number <span className="text-red-500">*</span></label>
            <input type="text" value={form.contactNumber} onChange={(e) => updateForm("contactNumber", e.target.value)} className={cls.input} placeholder="+92-300-1234567" />
          </div>
          <div>
            <label className={cls.label}>Email</label>
            <input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>City <span className="text-red-500">*</span></label>
            <input type="text" value={form.city} onChange={(e) => updateForm("city", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Area Focus</label>
            <input type="text" value={form.areaFocus} onChange={(e) => updateForm("areaFocus", e.target.value)} className={cls.input} placeholder="e.g. DHA Phase 5, Bahria Town" />
          </div>
          <div>
            <label className={cls.label}>Source Type <span className="text-red-500">*</span></label>
            <select value={form.sourceType} onChange={(e) => updateForm("sourceType", e.target.value)} className={cls.select}>
              <option value="BROKER">Broker</option>
              <option value="OWNER">Owner</option>
              <option value="CONSULTANT">Consultant</option>
            </select>
          </div>
          <div>
            <label className={cls.label}>Rating</label>
            <StarRating value={form.rating} onChange={(n) => updateForm("rating", n)} size={20} />
          </div>
          <div>
            <label className={cls.label}>First Contact Date</label>
            <input type="date" value={form.firstContactDate} onChange={(e) => updateForm("firstContactDate", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Last Availability Check</label>
            <input type="date" value={form.lastAvailabilityCheck} onChange={(e) => updateForm("lastAvailabilityCheck", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Status</label>
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className={cls.select}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={cls.label}>Notes</label>
            <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} className={cls.input} rows={3} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={closeModal} className={cls.btnSecondary} disabled={saving}>Cancel</button>
          <button onClick={handleSave} className={cls.btnPrimary} disabled={saving}>
            {saving ? "Saving…" : (editing ? "Save Changes" : "Create Agent")}
          </button>
        </div>
      </Modal>

      {/* Archive confirm */}
      <Modal isOpen={!!confirmArchive} onClose={() => setConfirmArchive(null)} title="Archive agent">
        <p className="text-[13px] text-gray-600">
          Archive <span className="font-semibold">{confirmArchive?.agentName}</span> ({confirmArchive?.agentCode})?
          Linked land and building records will stay but the agent will be flagged as archived.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirmArchive(null)} className={cls.btnSecondary}>Cancel</button>
          <button onClick={() => confirmArchive && handleArchive(confirmArchive)} className={`${cls.btnPrimary} bg-red-600 hover:bg-red-700`}>Archive</button>
        </div>
      </Modal>

      {/* CSV import */}
      <BulkImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Agents from CSV"
        columns={[
          { key: "agentName", label: "Agent Name", required: true, example: "John Doe" },
          { key: "companyName", label: "Company Name", example: "Skyline Realtors" },
          { key: "contactNumber", label: "Contact Number", required: true, example: "+92-300-1234567" },
          { key: "email", label: "Email", example: "john@example.com" },
          { key: "city", label: "City", required: true, example: "Lahore" },
          { key: "areaFocus", label: "Area Focus", example: "DHA Phase 5" },
          { key: "sourceType", label: "Source Type", required: true, example: "BROKER (one of BROKER/OWNER/CONSULTANT)" },
          { key: "rating", label: "Rating", example: "4 (1-5)" },
          { key: "firstContactDate", label: "First Contact Date", example: "2026-05-01" },
          { key: "status", label: "Status", example: "ACTIVE (ACTIVE/INACTIVE)" },
          { key: "notes", label: "Notes", example: "Optional" },
        ]}
        onImport={async (items) => {
          const res = await acquisitionAgentApi.bulkImport(items);
          return res.data.data;
        }}
        onComplete={() => { setImportOpen(false); fetchAgents(); }}
      />
    </div>
  );
}
