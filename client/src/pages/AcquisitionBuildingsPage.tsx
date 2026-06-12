import { useState, useEffect, useCallback } from "react";
import { acquisitionAgentApi, acquisitionBuildingApi } from "../lib/api";
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
  Briefcase,
  Download,
  Upload,
} from "lucide-react";

interface AgentLite { id: string; agentCode: string; agentName: string; companyName: string | null; deletedAt: string | null; }
interface Building {
  id: string;
  buildingCode: string;
  agentId: string | null;
  agent: AgentLite | null;
  city: string;
  areaLocation: string | null;
  propertyAddress: string | null;
  coordinates: string | null;
  coveredAreaSqft: string | null;
  plotSizeKanal: string | null;
  floors: number | null;
  floorPlateSizeSqft: string | null;
  parkingCapacity: number | null;
  buildingStatus: "READY" | "UNDER_CONSTRUCTION" | null;
  possessionTimeline: string | null;
  utilities: string[];
  powerBackup: string | null;
  elevators: number | null;
  proposedModel: "LEASE" | "JV" | "OPERATOR" | null;
  askingRent: string | null;
  stage: "REVIEW" | "VISIT" | "NEGOTIATION" | "CLOSED_WON" | "CLOSED_LOST";
  status: "ACTIVE" | "INACTIVE";
  lastAvailabilityCheck: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const BUILDING_STATUS_LABELS: Record<string, string> = { READY: "Ready", UNDER_CONSTRUCTION: "Under Construction" };
const PROPOSED_LABELS: Record<string, string> = { LEASE: "Lease", JV: "JV", OPERATOR: "Operator" };
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
  propertyAddress: "",
  coordinates: "",
  coveredAreaSqft: "",
  plotSizeKanal: "",
  floors: "",
  floorPlateSizeSqft: "",
  parkingCapacity: "",
  buildingStatus: "",
  possessionTimeline: "",
  utilities: [] as string[],
  powerBackup: "",
  elevators: "",
  proposedModel: "",
  askingRent: "",
  stage: "REVIEW",
  status: "ACTIVE",
  lastAvailabilityCheck: "",
  notes: "",
};

function fmtPKR(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (Number.isNaN(n)) return "—";
  const s = n.toFixed(0);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const withCommas = rest.length ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `Rs ${withCommas}`;
}

export default function AcquisitionBuildingsPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.ACQUISITIONS.CREATE);
  const canEdit = hasPermission(PERMISSIONS.ACQUISITIONS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.ACQUISITIONS.DELETE);
  const canImport = hasPermission(PERMISSIONS.ACQUISITIONS.IMPORT);
  const canExport = hasPermission(PERMISSIONS.ACQUISITIONS.EXPORT);

  const [rows, setRows] = useState<Building[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [buildingStatusFilter, setBuildingStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, page: 1, limit: 25 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");

  const [confirmArchive, setConfirmArchive] = useState<Building | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { page, limit: 25 };
      if (search) params.search = search;
      if (stageFilter) params.stage = stageFilter;
      if (statusFilter) params.status = statusFilter;
      if (buildingStatusFilter) params.buildingStatus = buildingStatusFilter;
      if (cityFilter) params.city = cityFilter;
      if (includeDeleted) params.includeDeleted = true;
      const res = await acquisitionBuildingApi.list(params);
      setRows(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load building records");
    } finally {
      setLoading(false);
    }
  }, [page, search, stageFilter, statusFilter, buildingStatusFilter, cityFilter, includeDeleted, toast]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    acquisitionAgentApi.list({ limit: 500 })
      .then((r) => setAgents(r.data.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (r: Building) => {
    setEditing(r);
    setForm({
      agentId: r.agentId || "",
      city: r.city,
      areaLocation: r.areaLocation || "",
      propertyAddress: r.propertyAddress || "",
      coordinates: r.coordinates || "",
      coveredAreaSqft: r.coveredAreaSqft || "",
      plotSizeKanal: r.plotSizeKanal || "",
      floors: r.floors?.toString() || "",
      floorPlateSizeSqft: r.floorPlateSizeSqft || "",
      parkingCapacity: r.parkingCapacity?.toString() || "",
      buildingStatus: r.buildingStatus || "",
      possessionTimeline: r.possessionTimeline || "",
      utilities: r.utilities || [],
      powerBackup: r.powerBackup || "",
      elevators: r.elevators?.toString() || "",
      proposedModel: r.proposedModel || "",
      askingRent: r.askingRent || "",
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
      if (editing) await acquisitionBuildingApi.update(editing.id, payload);
      else await acquisitionBuildingApi.create(payload);
      toast.success(editing ? "Building updated" : "Building created");
      closeModal();
      fetchRows();
    } catch (err: any) {
      const data = err.response?.data;
      let msg = data?.error || "Failed to save building";
      if (Array.isArray(data?.details) && data.details.length > 0) {
        msg = `${msg} — ${data.details.map((d: any) => `${d.path}: ${d.message}`).join("; ")}`;
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (r: Building) => {
    try { await acquisitionBuildingApi.remove(r.id); toast.success("Archived"); setConfirmArchive(null); fetchRows(); }
    catch { toast.error("Failed to archive"); }
  };
  const handleRestore = async (r: Building) => {
    try { await acquisitionBuildingApi.restore(r.id); toast.success("Restored"); fetchRows(); }
    catch { toast.error("Failed to restore"); }
  };

  const handleExport = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (stageFilter) params.stage = stageFilter;
    if (statusFilter) params.status = statusFilter;
    if (buildingStatusFilter) params.buildingStatus = buildingStatusFilter;
    if (cityFilter) params.city = cityFilter;
    const url = acquisitionBuildingApi.exportUrl(params);
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `acquisition-buildings-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const agentLabel = (a: AgentLite | null) => a ? `${a.agentCode} — ${a.agentName}${a.companyName ? ` (${a.companyName})` : ""}${a.deletedAt ? " [archived]" : ""}` : "—";

  return (
    <div>
      <PageHeader
        title="Building Inventory"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "building record" : "building records"} total`}
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
                <Plus size={14} /> Add Building
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
        <select value={buildingStatusFilter} onChange={(e) => { setBuildingStatusFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Conditions</option>
          <option value="READY">Ready</option>
          <option value="UNDER_CONSTRUCTION">Under Construction</option>
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
                <th className={cls.th}>Property ID</th>
                <th className={cls.th}>Agent</th>
                <th className={cls.th}>City</th>
                <th className={cls.th}>Area</th>
                <th className={cls.th}>Covered (sqft)</th>
                <th className={cls.th}>Floors</th>
                <th className={cls.th}>Condition</th>
                <th className={cls.th}>Model</th>
                <th className={cls.th}>Asking Rent</th>
                <th className={cls.th}>Stage</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th + " text-right"}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12}><TableLoading /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12}>
                  <EmptyState icon={<Briefcase size={48} />} title="No building records" subtitle="Try adjusting filters or add a new building record" />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => openEdit(r)} className={cls.trClick}>
                    <td className={`px-3 py-2 ${cls.mono}`}>{r.buildingCode}</td>
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
                    <td className="px-3 py-2 text-gray-600">{r.coveredAreaSqft || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.floors ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.buildingStatus ? BUILDING_STATUS_LABELS[r.buildingStatus] : "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.proposedModel ? PROPOSED_LABELS[r.proposedModel] : "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{fmtPKR(r.askingRent)}</td>
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

      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? `Edit ${editing.buildingCode}` : "Add Building"}>
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
            <label className={cls.label}>Property Address</label>
            <textarea value={form.propertyAddress} onChange={(e) => updateForm("propertyAddress", e.target.value)} className={cls.input} rows={2} />
          </div>
          <div>
            <label className={cls.label}>Coordinates <span className="text-[11px] text-gray-400">(paste from Google Maps)</span></label>
            <input type="text" placeholder="33.6844, 73.0479" value={form.coordinates} onChange={(e) => updateForm("coordinates", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Covered Area (sqft)</label>
            <input type="number" step="0.01" value={form.coveredAreaSqft} onChange={(e) => updateForm("coveredAreaSqft", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Plot Size (Kanal)</label>
            <input type="number" step="0.01" value={form.plotSizeKanal} onChange={(e) => updateForm("plotSizeKanal", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Floors</label>
            <input type="number" value={form.floors} onChange={(e) => updateForm("floors", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Floor Plate Size (sqft)</label>
            <input type="number" step="0.01" value={form.floorPlateSizeSqft} onChange={(e) => updateForm("floorPlateSizeSqft", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Parking Capacity</label>
            <input type="number" value={form.parkingCapacity} onChange={(e) => updateForm("parkingCapacity", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Building Status</label>
            <select value={form.buildingStatus} onChange={(e) => updateForm("buildingStatus", e.target.value)} className={cls.select}>
              <option value="">—</option>
              <option value="READY">Ready</option>
              <option value="UNDER_CONSTRUCTION">Under Construction</option>
            </select>
          </div>
          <div>
            <label className={cls.label}>Possession Timeline</label>
            <input type="text" value={form.possessionTimeline} onChange={(e) => updateForm("possessionTimeline", e.target.value)} className={cls.input} placeholder="e.g. Immediate, 3 months" />
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
            <label className={cls.label}>Power Backup</label>
            <input type="text" value={form.powerBackup} onChange={(e) => updateForm("powerBackup", e.target.value)} className={cls.input} placeholder="e.g. 24/7 generator, UPS only" />
          </div>
          <div>
            <label className={cls.label}>Elevators</label>
            <input type="number" value={form.elevators} onChange={(e) => updateForm("elevators", e.target.value)} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Proposed Model</label>
            <select value={form.proposedModel} onChange={(e) => updateForm("proposedModel", e.target.value)} className={cls.select}>
              <option value="">—</option>
              <option value="LEASE">Lease</option>
              <option value="JV">JV</option>
              <option value="OPERATOR">Operator</option>
            </select>
          </div>
          <div>
            <label className={cls.label}>Asking Rent (PKR / month)</label>
            <input type="number" step="0.01" value={form.askingRent} onChange={(e) => updateForm("askingRent", e.target.value)} className={cls.input} />
            {form.askingRent && <p className="mt-0.5 text-[11px] text-gray-500">{fmtPKR(form.askingRent)}</p>}
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
            {saving ? "Saving…" : (editing ? "Save Changes" : "Create Building")}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!confirmArchive} onClose={() => setConfirmArchive(null)} title="Archive building record">
        <p className="text-[13px] text-gray-600">
          Archive <span className="font-semibold">{confirmArchive?.buildingCode}</span>? It will be hidden from active views but can be restored later.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirmArchive(null)} className={cls.btnSecondary}>Cancel</button>
          <button onClick={() => confirmArchive && handleArchive(confirmArchive)} className={`${cls.btnPrimary} bg-red-600 hover:bg-red-700`}>Archive</button>
        </div>
      </Modal>

      <BulkImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Buildings from CSV"
        columns={[
          { key: "agentCode", label: "Agent Code", example: "AGT-00001" },
          { key: "city", label: "City", required: true, example: "Islamabad" },
          { key: "areaLocation", label: "Area / Location", example: "Blue Area" },
          { key: "propertyAddress", label: "Property Address", example: "ABC Plaza" },
          { key: "coordinates", label: "Coordinates", example: "33.6844, 73.0479" },
          { key: "coveredAreaSqft", label: "Covered Area (sqft)", example: "15000" },
          { key: "plotSizeKanal", label: "Plot Size (Kanal)", example: "8" },
          { key: "floors", label: "Floors", example: "12" },
          { key: "floorPlateSizeSqft", label: "Floor Plate (sqft)", example: "1200" },
          { key: "parkingCapacity", label: "Parking Capacity", example: "80" },
          { key: "buildingStatus", label: "Building Status", example: "READY (or UNDER_CONSTRUCTION)" },
          { key: "possessionTimeline", label: "Possession Timeline", example: "Immediate" },
          { key: "utilities", label: "Utilities", example: "WATER|ELECTRICITY|GAS" },
          { key: "powerBackup", label: "Power Backup", example: "Generator + UPS" },
          { key: "elevators", label: "Elevators", example: "3" },
          { key: "proposedModel", label: "Proposed Model", example: "LEASE (or JV/OPERATOR)" },
          { key: "askingRent", label: "Asking Rent (PKR)", example: "2500000" },
          { key: "stage", label: "Stage", example: "REVIEW" },
          { key: "status", label: "Status", example: "ACTIVE" },
          { key: "notes", label: "Notes", example: "" },
        ]}
        onImport={async (items) => {
          const res = await acquisitionBuildingApi.bulkImport(items);
          return res.data.data;
        }}
        onComplete={() => { setImportOpen(false); fetchRows(); }}
      />
    </div>
  );
}
