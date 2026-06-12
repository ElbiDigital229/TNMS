import { useState, useEffect, useCallback } from "react";
import { acquisitionAgentApi, acquisitionLandApi } from "../lib/api";
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
  MapPin,
  Download,
  Upload,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────
interface AgentLite { id: string; agentCode: string; agentName: string; companyName: string | null; deletedAt: string | null; }
interface Land {
  id: string;
  landCode: string;
  agentId: string | null;
  agent: AgentLite | null;
  city: string;
  areaLocation: string | null;
  addressDescription: string | null;
  coordinates: string | null;
  plotSizeKanal: string | null;
  frontRoadWidthFt: string | null;
  zoning: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | null;
  developmentStatus: string | null;
  maxCoveredAreaSqft: string | null;
  utilities: string[];
  parkingPotential: string | null;
  proposedModel: "JV" | "DEVELOPMENT" | "SALE" | null;
  askingPrice: string | null;
  ownerFlexibility: string | null;
  stage: "REVIEW" | "VISIT" | "NEGOTIATION" | "CLOSED_WON" | "CLOSED_LOST";
  status: "ACTIVE" | "INACTIVE";
  lastAvailabilityCheck: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const ZONING_LABELS: Record<string, string> = { RESIDENTIAL: "Residential", COMMERCIAL: "Commercial", MIXED_USE: "Mixed Use" };
const PROPOSED_LABELS: Record<string, string> = { JV: "JV", DEVELOPMENT: "Development", SALE: "Sale" };
const STAGE_LABELS: Record<string, string> = { REVIEW: "Review", VISIT: "Visit", NEGOTIATION: "Negotiation", CLOSED_WON: "Closed (Won)", CLOSED_LOST: "Closed (Lost)" };
const STAGE_COLORS: Record<string, string> = {
  REVIEW: "bg-gray-100 text-gray-600",
  VISIT: "bg-blue-50 text-blue-700",
  NEGOTIATION: "bg-amber-50 text-amber-700",
  CLOSED_WON: "bg-emerald-50 text-emerald-700",
  CLOSED_LOST: "bg-red-50 text-red-700",
};
const UTILITY_PRESETS = ["WATER", "GAS", "ELECTRICITY", "SEWERAGE", "INTERNET", "PHONE", "BOREWELL", "SOLAR"] as const;

const emptyForm = {
  agentId: "",
  city: "",
  areaLocation: "",
  addressDescription: "",
  coordinates: "",
  plotSizeKanal: "",
  frontRoadWidthFt: "",
  zoning: "",
  developmentStatus: "",
  maxCoveredAreaSqft: "",
  utilities: [] as string[],
  parkingPotential: "",
  proposedModel: "",
  askingPrice: "",
  ownerFlexibility: "",
  stage: "REVIEW",
  status: "ACTIVE",
  lastAvailabilityCheck: "",
  notes: "",
};

/** Format a PKR amount (decimal as string from API) using Indian/PK grouping. */
function fmtPKR(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (Number.isNaN(n)) return "—";
  // South Asian "lakh/crore" grouping
  const s = n.toFixed(0);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const withCommas = rest.length ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `Rs ${withCommas}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────
export default function AcquisitionLandPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.ACQUISITIONS.CREATE);
  const canEdit = hasPermission(PERMISSIONS.ACQUISITIONS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.ACQUISITIONS.DELETE);
  const canImport = hasPermission(PERMISSIONS.ACQUISITIONS.IMPORT);
  const canExport = hasPermission(PERMISSIONS.ACQUISITIONS.EXPORT);

  const [rows, setRows] = useState<Land[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [zoningFilter, setZoningFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1, limit: 25 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Land | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");

  const [confirmArchive, setConfirmArchive] = useState<Land | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { page, limit: 25 };
      if (search) params.search = search;
      if (stageFilter) params.stage = stageFilter;
      if (statusFilter) params.status = statusFilter;
      if (zoningFilter) params.zoning = zoningFilter;
      if (cityFilter) params.city = cityFilter;
      if (includeDeleted) params.includeDeleted = true;
      const res = await acquisitionLandApi.list(params);
      setRows(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load land records");
    } finally {
      setLoading(false);
    }
  }, [page, search, stageFilter, statusFilter, zoningFilter, cityFilter, includeDeleted, toast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Load all agents for the picker (one-shot)
  useEffect(() => {
    acquisitionAgentApi.list({ limit: 500 })
      .then((r) => setAgents(r.data.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (r: Land) => {
    setEditing(r);
    setForm({
      agentId: r.agentId || "",
      city: r.city,
      areaLocation: r.areaLocation || "",
      addressDescription: r.addressDescription || "",
      coordinates: r.coordinates || "",
      plotSizeKanal: r.plotSizeKanal || "",
      frontRoadWidthFt: r.frontRoadWidthFt || "",
      zoning: r.zoning || "",
      developmentStatus: r.developmentStatus || "",
      maxCoveredAreaSqft: r.maxCoveredAreaSqft || "",
      utilities: r.utilities || [],
      parkingPotential: r.parkingPotential || "",
      proposedModel: r.proposedModel || "",
      askingPrice: r.askingPrice || "",
      ownerFlexibility: r.ownerFlexibility || "",
      stage: r.stage,
      status: r.status,
      lastAvailabilityCheck: r.lastAvailabilityCheck ? r.lastAvailabilityCheck.slice(0, 10) : "",
      notes: r.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(emptyForm); setAgentSearch(""); };
  const updateForm = (k: keyof typeof emptyForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleUtility = (u: string) => {
    setForm((f) => ({
      ...f,
      utilities: f.utilities.includes(u) ? f.utilities.filter((x) => x !== u) : [...f.utilities, u],
    }));
  };

  const handleSave = async () => {
    if (!form.city.trim()) return toast.error("City is required");
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) await acquisitionLandApi.update(editing.id, payload);
      else await acquisitionLandApi.create(payload);
      toast.success(editing ? "Land record updated" : "Land record created");
      closeModal();
      fetchRows();
    } catch (err: any) {
      const data = err.response?.data;
      let msg = data?.error || "Failed to save record";
      if (Array.isArray(data?.details) && data.details.length > 0) {
        msg = `${msg} — ${data.details.map((d: any) => `${d.path}: ${d.message}`).join("; ")}`;
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (r: Land) => {
    try {
      await acquisitionLandApi.remove(r.id);
      toast.success("Land record archived");
      setConfirmArchive(null);
      fetchRows();
    } catch {
      toast.error("Failed to archive");
    }
  };

  const handleRestore = async (r: Land) => {
    try {
      await acquisitionLandApi.restore(r.id);
      toast.success("Restored");
      fetchRows();
    } catch {
      toast.error("Failed to restore");
    }
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (stageFilter) params.stage = stageFilter;
    if (statusFilter) params.status = statusFilter;
    if (zoningFilter) params.zoning = zoningFilter;
    if (cityFilter) params.city = cityFilter;
    const url = acquisitionLandApi.exportUrl(params);
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `acquisition-land-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Failed to export"));
  };

  const filteredAgents = agentSearch.trim()
    ? agents.filter((a) =>
        a.agentCode.toLowerCase().includes(agentSearch.toLowerCase()) ||
        a.agentName.toLowerCase().includes(agentSearch.toLowerCase()) ||
        (a.companyName || "").toLowerCase().includes(agentSearch.toLowerCase()),
      )
    : agents;

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB") : "—";
  const agentLabel = (a: AgentLite | null) => a ? `${a.agentCode} — ${a.agentName}${a.companyName ? ` (${a.companyName})` : ""}${a.deletedAt ? " [archived]" : ""}` : "—";

  return (
    <div>
      <PageHeader
        title="Land Inventory"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "land record" : "land records"} total`}
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
                <Plus size={14} /> Add Land
              </button>
            )}
          </>
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search code, area, notes…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${cls.input} pl-8`}
          />
        </div>
        <input type="text" placeholder="City…" value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className={cls.input} />
        <select value={zoningFilter} onChange={(e) => { setZoningFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Zoning</option>
          <option value="RESIDENTIAL">Residential</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="MIXED_USE">Mixed Use</option>
        </select>
        <select value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Stages</option>
          <option value="REVIEW">Review</option>
          <option value="VISIT">Visit</option>
          <option value="NEGOTIATION">Negotiation</option>
          <option value="CLOSED_WON">Closed (Won)</option>
          <option value="CLOSED_LOST">Closed (Lost)</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <label className="inline-flex items-center gap-2 text-[12px] text-gray-600">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1); }} className="rounded border-gray-300" />
          Show archived
        </label>
      </div>

      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>Land ID</th>
                <th className={cls.th}>Agent</th>
                <th className={cls.th}>City</th>
                <th className={cls.th}>Area</th>
                <th className={cls.th}>Plot (Kanal)</th>
                <th className={cls.th}>Zoning</th>
                <th className={cls.th}>Model</th>
                <th className={cls.th}>Asking</th>
                <th className={cls.th}>Stage</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th + " text-right"}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11}><TableLoading /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11}>
                  <EmptyState icon={<MapPin size={48} />} title="No land records" subtitle="Try adjusting filters or add a new land record" />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => openEdit(r)} className={cls.trClick}>
                    <td className={`px-3 py-2 ${cls.mono}`}>{r.landCode}</td>
                    <td className="px-3 py-2 text-gray-600 text-[12px]">
                      {r.agent ? (
                        <span>
                          <span className={cls.mono}>{r.agent.agentCode}</span>
                          <span className="ml-1">— {r.agent.agentName}</span>
                          {r.agent.deletedAt && <span className="ml-1 text-red-500">(archived)</span>}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{r.city}</td>
                    <td className="px-3 py-2 text-gray-600">{r.areaLocation || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.plotSizeKanal || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.zoning ? ZONING_LABELS[r.zoning] : "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.proposedModel ? PROPOSED_LABELS[r.proposedModel] : "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{fmtPKR(r.askingPrice)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_COLORS[r.stage]}`}>
                        {STAGE_LABELS[r.stage]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[r.status]}`}>
                        {r.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                      {r.deletedAt && (
                        <span className="ml-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">Archived</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {canEdit && (
                          <button onClick={() => openEdit(r)} className={cls.btnIcon} title="Edit"><Pencil size={14} /></button>
                        )}
                        {canDelete && !r.deletedAt && (
                          <button onClick={() => setConfirmArchive(r)} className={cls.btnIcon} title="Archive"><Trash2 size={14} className="text-red-600" /></button>
                        )}
                        {canDelete && r.deletedAt && (
                          <button onClick={() => handleRestore(r)} className={cls.btnIcon} title="Restore"><RotateCcw size={14} className="text-emerald-600" /></button>
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

      {/* Form */}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.landCode}` : "Add Land"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={cls.label}>Agent</label>
            <input type="text" placeholder="Search by code, name, or company…" value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} className={`${cls.input} mb-1`} />
            <select value={form.agentId} onChange={(e) => updateForm("agentId", e.target.value)} className={cls.select} size={Math.min(6, filteredAgents.length + 1)}>
              <option value="">(No agent)</option>
              {filteredAgents.map((a) => (
                <option key={a.id} value={a.id}>{agentLabel(a)}</option>
              ))}
            </select>
            {form.agentId && agents.find((a) => a.id === form.agentId) && (
              <p className="mt-1 text-[11px] text-gray-500">Selected: <span className={cls.mono}>{agentLabel(agents.find((a) => a.id === form.agentId)!)}</span></p>
            )}
          </div>
          <div>
            <label className={cls.label}>City <span className="text-red-500">*</span></label>
            <input type="text" value={form.city} onChange={(e) => updateForm("city", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Area / Location</label>
            <input type="text" value={form.areaLocation} onChange={(e) => updateForm("areaLocation", e.target.value)} className={cls.input} />
          </div>
          <div className="sm:col-span-2">
            <label className={cls.label}>Address / Description</label>
            <textarea value={form.addressDescription} onChange={(e) => updateForm("addressDescription", e.target.value)} className={cls.input} rows={2} />
          </div>
          <div>
            <label className={cls.label}>Coordinates <span className="text-[11px] text-gray-400">(paste from Google Maps)</span></label>
            <input type="text" placeholder="33.6844, 73.0479" value={form.coordinates} onChange={(e) => updateForm("coordinates", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Plot Size (Kanal)</label>
            <input type="number" step="0.01" value={form.plotSizeKanal} onChange={(e) => updateForm("plotSizeKanal", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Front Road Width (ft)</label>
            <input type="number" step="0.01" value={form.frontRoadWidthFt} onChange={(e) => updateForm("frontRoadWidthFt", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Zoning</label>
            <select value={form.zoning} onChange={(e) => updateForm("zoning", e.target.value)} className={cls.select}>
              <option value="">—</option>
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="MIXED_USE">Mixed Use</option>
            </select>
          </div>
          <div>
            <label className={cls.label}>Development Status</label>
            <input type="text" value={form.developmentStatus} onChange={(e) => updateForm("developmentStatus", e.target.value)} className={cls.input} placeholder="e.g. Empty plot, partially built" />
          </div>
          <div>
            <label className={cls.label}>Max Covered Area (sqft)</label>
            <input type="number" step="0.01" value={form.maxCoveredAreaSqft} onChange={(e) => updateForm("maxCoveredAreaSqft", e.target.value)} className={cls.input} />
          </div>
          <div className="sm:col-span-2">
            <label className={cls.label}>Utilities Available</label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {UTILITY_PRESETS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => toggleUtility(u)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    form.utilities.includes(u)
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={cls.label}>Parking Potential</label>
            <input type="text" value={form.parkingPotential} onChange={(e) => updateForm("parkingPotential", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Proposed Model</label>
            <select value={form.proposedModel} onChange={(e) => updateForm("proposedModel", e.target.value)} className={cls.select}>
              <option value="">—</option>
              <option value="JV">JV</option>
              <option value="DEVELOPMENT">Development</option>
              <option value="SALE">Sale</option>
            </select>
          </div>
          <div>
            <label className={cls.label}>Asking Price (PKR)</label>
            <input type="number" step="0.01" value={form.askingPrice} onChange={(e) => updateForm("askingPrice", e.target.value)} className={cls.input} placeholder="e.g. 50000000" />
            {form.askingPrice && <p className="mt-0.5 text-[11px] text-gray-500">{fmtPKR(form.askingPrice)}</p>}
          </div>
          <div>
            <label className={cls.label}>Owner Flexibility</label>
            <input type="text" value={form.ownerFlexibility} onChange={(e) => updateForm("ownerFlexibility", e.target.value)} className={cls.input} placeholder="e.g. Negotiable on price" />
          </div>
          <div>
            <label className={cls.label}>Stage</label>
            <select value={form.stage} onChange={(e) => updateForm("stage", e.target.value)} className={cls.select}>
              <option value="REVIEW">Review</option>
              <option value="VISIT">Visit</option>
              <option value="NEGOTIATION">Negotiation</option>
              <option value="CLOSED_WON">Closed (Won)</option>
              <option value="CLOSED_LOST">Closed (Lost)</option>
            </select>
          </div>
          <div>
            <label className={cls.label}>Status</label>
            <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className={cls.select}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div>
            <label className={cls.label}>Last Availability Check</label>
            <input type="date" value={form.lastAvailabilityCheck} onChange={(e) => updateForm("lastAvailabilityCheck", e.target.value)} className={cls.input} />
          </div>
          <div className="sm:col-span-2">
            <label className={cls.label}>Notes</label>
            <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} className={cls.input} rows={3} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={closeModal} className={cls.btnSecondary} disabled={saving}>Cancel</button>
          <button onClick={handleSave} className={cls.btnPrimary} disabled={saving}>
            {saving ? "Saving…" : (editing ? "Save Changes" : "Create Land")}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!confirmArchive} onClose={() => setConfirmArchive(null)} title="Archive land record">
        <p className="text-[13px] text-gray-600">
          Archive <span className="font-semibold">{confirmArchive?.landCode}</span>? It will be hidden from active views but can be restored later.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirmArchive(null)} className={cls.btnSecondary}>Cancel</button>
          <button onClick={() => confirmArchive && handleArchive(confirmArchive)} className={`${cls.btnPrimary} bg-red-600 hover:bg-red-700`}>Archive</button>
        </div>
      </Modal>

      <BulkImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Land from CSV"
        columns={[
          { key: "agentCode", label: "Agent Code", example: "AGT-00001 (will be linked to the agent)" },
          { key: "city", label: "City", required: true, example: "Lahore" },
          { key: "areaLocation", label: "Area / Location", example: "DHA Phase 5" },
          { key: "addressDescription", label: "Address / Description", example: "Plot 123" },
          { key: "coordinates", label: "Coordinates", example: "33.6844, 73.0479" },
          { key: "plotSizeKanal", label: "Plot Size (Kanal)", example: "10" },
          { key: "frontRoadWidthFt", label: "Front Road Width (ft)", example: "40" },
          { key: "zoning", label: "Zoning", example: "COMMERCIAL (one of RESIDENTIAL/COMMERCIAL/MIXED_USE)" },
          { key: "maxCoveredAreaSqft", label: "Max Covered Area (sqft)", example: "12000" },
          { key: "utilities", label: "Utilities", example: "WATER|GAS|ELECTRICITY (separated by | or ,)" },
          { key: "parkingPotential", label: "Parking Potential", example: "30 cars" },
          { key: "proposedModel", label: "Proposed Model", example: "JV (one of JV/DEVELOPMENT/SALE)" },
          { key: "askingPrice", label: "Asking Price (PKR)", example: "50000000" },
          { key: "stage", label: "Stage", example: "REVIEW" },
          { key: "status", label: "Status", example: "ACTIVE" },
          { key: "notes", label: "Notes", example: "" },
        ]}
        onImport={async (items) => {
          const res = await acquisitionLandApi.bulkImport(items);
          return res.data.data;
        }}
        onComplete={() => { setImportOpen(false); fetchRows(); }}
      />
    </div>
  );
}
