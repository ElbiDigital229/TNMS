import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { acquisitionLandApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { cls } from "../lib/styles";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import BulkImportModal from "../components/ui/BulkImportModal";
import RowActionsMenu, { type RowActionsMenuItem } from "../components/ui/RowActionsMenu";
import {
  Plus,
  Search,
  MapPin,
  Download,
  Upload,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";

interface AgentLite { id: string; agentCode: string; agentName: string; companyName: string | null; deletedAt: string | null; }
interface Land {
  id: string;
  landCode: string;
  agentId: string | null;
  agent: AgentLite | null;
  city: string;
  areaLocation: string | null;
  plotSizeKanal: string | null;
  zoning: "RESIDENTIAL" | "COMMERCIAL" | "MIXED_USE" | null;
  proposedModel: "JV" | "DEVELOPMENT" | "SALE" | null;
  askingPrice: string | null;
  stage: "REVIEW" | "VISIT" | "NEGOTIATION" | "CLOSED_WON" | "CLOSED_LOST";
  status: "ACTIVE" | "INACTIVE";
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

function fmtPKR(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (Number.isNaN(n)) return "—";
  const s = n.toFixed(0);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.length ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `Rs ${grouped}`;
}

function buildLandMenuItems({
  row,
  canEdit,
  canDelete,
  navigate,
  onArchive,
  onRestore,
}: {
  row: Land;
  canEdit: boolean;
  canDelete: boolean;
  navigate: (to: string) => void;
  onArchive: () => void;
  onRestore: () => void;
}): RowActionsMenuItem[] {
  const items: RowActionsMenuItem[] = [
    { label: "View", icon: Eye, onClick: () => navigate(`/acquisitions/land/${row.id}/edit`) },
  ];
  if (canEdit) {
    items.push({ label: "Edit", icon: Pencil, onClick: () => navigate(`/acquisitions/land/${row.id}/edit`) });
  }
  if (canDelete && !row.deletedAt) {
    items.push({ label: "Archive", icon: Trash2, onClick: onArchive, variant: "danger" });
  }
  if (canDelete && row.deletedAt) {
    items.push({ label: "Restore", icon: RotateCcw, onClick: onRestore, variant: "success" });
  }
  return items;
}

export default function AcquisitionLandPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.ACQUISITIONS.CREATE);
  const canEdit = hasPermission(PERMISSIONS.ACQUISITIONS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.ACQUISITIONS.DELETE);
  const canImport = hasPermission(PERMISSIONS.ACQUISITIONS.IMPORT);
  const canExport = hasPermission(PERMISSIONS.ACQUISITIONS.EXPORT);

  const [rows, setRows] = useState<Land[]>([]);
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

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleArchive = async (r: Land) => {
    try {
      await acquisitionLandApi.remove(r.id);
      toast.success("Land record archived");
      setConfirmArchive(null);
      fetchRows();
    } catch { toast.error("Failed to archive"); }
  };
  const handleRestore = async (r: Land) => {
    try { await acquisitionLandApi.restore(r.id); toast.success("Restored"); fetchRows(); }
    catch { toast.error("Failed to restore"); }
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

  return (
    <div>
      <PageHeader
        title="Land Inventory"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "land record" : "land records"} total`}
        actions={
          <>
            {canExport && (<button onClick={handleExport} className={cls.btnSecondary}><Download size={14} /> Export</button>)}
            {canImport && (<button onClick={() => setImportOpen(true)} className={cls.btnSecondary}><Upload size={14} /> Import</button>)}
            {canCreate && (<button onClick={() => navigate("/acquisitions/land/new")} className={cls.btnPrimary}><Plus size={14} /> Create Land</button>)}
          </>
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search code, area, notes…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className={`${cls.input} pl-8`} />
        </div>
        <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Cities</option>
          <option value="Lahore">Lahore</option>
          <option value="Islamabad">Islamabad</option>
          <option value="Karachi">Karachi</option>
          <option value="Rawalpindi">Rawalpindi</option>
        </select>
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
        <div className="border-b border-gray-100 px-4 py-2.5 text-[13px] font-semibold text-gray-700">
          Details
        </div>
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
                <th className={cls.th + " text-right"}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10}><TableLoading /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10}>
                  <EmptyState icon={<MapPin size={48} />} title="No land records" subtitle="Try adjusting filters or add a new land record" />
                </td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/acquisitions/land/${r.id}/edit`)} className={cls.trClick}>
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
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_COLORS[r.stage]}`}>{STAGE_LABELS[r.stage]}</span>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu
                        items={buildLandMenuItems({
                          row: r,
                          canEdit,
                          canDelete,
                          navigate,
                          onArchive: () => setConfirmArchive(r),
                          onRestore: () => handleRestore(r),
                        })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>

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
