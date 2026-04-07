import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { assetApi, assetCategoryApi, ticketApi, departmentApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import { cls, STATUS_COLOR, PRIORITY_COLOR, CONDITION_COLOR } from "../lib/styles";
import { ConditionBadge, StatusBadge, PriorityBadge, ActiveBadge } from "../components/ui/Badge";
import { TableLoading } from "../components/ui/DataTable";
import { CONDITION_LABELS, TICKET_STATUS_LABELS, PRIORITY_LABELS } from "../../../shared/types";
import { PERMISSIONS } from "../../../shared/permissions";
import { ArrowLeft, Building2, Download, Edit2, Layers, Package, Plus, ClipboardList, ExternalLink } from "lucide-react";
import api from "../lib/api";

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;
const UNITS_OF_MEASURE = ["NOS", "MTR", "SFT", "SET", "LOT", "KG", "LTR", "PKT", "BOX", "ROLL"] as const;

export default function AssetDetailPage() {
  const { code } = useParams();
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", categoryId: "", unitOfMeasure: "", condition: "", serialNumber: "", additionalInfo: "",
  });

  // Create ticket modal
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);
  const [units, setUnits] = useState<{ id: string; name: string; code: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [ticketCategories, setTicketCategories] = useState<{ id: string; name: string }[]>([]);
  const [ticketForm, setTicketForm] = useState({
    name: "", description: "", unitId: "", dueDate: "",
    taskType: "MAINTENANCE", subTaskType: "REACTIVE",
    departmentId: "", priority: "MEDIUM", categoryId: "",
  });

  // Ticket history
  const [ticketHistory, setTicketHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const canEdit = user?.isSuperAdmin || user?.permissions?.includes("assets.edit");

  const fetchAsset = () => {
    if (!code) return;
    assetApi.getByCode(code)
      .then((res) => {
        if (res.data.success) setAsset(res.data.data);
        else setError("Asset not found");
      })
      .catch(() => setError("Failed to load asset"))
      .finally(() => setLoading(false));
  };

  const fetchHistory = (assetId: string) => {
    setHistoryLoading(true);
    assetApi.getTickets(assetId)
      .then((res) => setTicketHistory(res.data.data || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    fetchAsset();
    assetCategoryApi.list().then((res) => setCategories(res.data.data)).catch(() => {});
  }, [code]);

  useEffect(() => {
    if (asset?.id) fetchHistory(asset.id);
  }, [asset?.id]);

  const openEdit = () => {
    setEditForm({
      name: asset.name || "", categoryId: asset.category?.id || asset.categoryId || "",
      unitOfMeasure: asset.unitOfMeasure || "", condition: asset.condition || "",
      serialNumber: asset.serialNumber || "", additionalInfo: asset.additionalInfo || "",
    });
    setEditOpen(true);
  };

  const openTicketModal = () => {
    setTicketForm({ name: "", description: "", unitId: "", dueDate: "", taskType: "MAINTENANCE", subTaskType: "REACTIVE", departmentId: "", priority: "MEDIUM", categoryId: "" });
    if (asset?.propertyId) {
      api.get(`/properties/${asset.propertyId}/units`).then((r) => setUnits(r.data.data || [])).catch(() => {});
    }
    departmentApi.list().then((r) => setDepartments(r.data.data?.filter((d: any) => d.status === "ACTIVE") || [])).catch(() => {});
    api.get("/ticket-categories").then((r) => setTicketCategories(r.data.data || [])).catch(() => {});
    setTicketOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("categoryId", editForm.categoryId);
      formData.append("unitOfMeasure", editForm.unitOfMeasure);
      formData.append("condition", editForm.condition);
      formData.append("serialNumber", editForm.serialNumber);
      formData.append("additionalInfo", editForm.additionalInfo);
      await assetApi.update(asset.id, formData);
      toast.success("Asset updated");
      setEditOpen(false);
      fetchAsset();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update asset");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketForm.name.trim() || !ticketForm.description.trim()) {
      toast.error("Title and description are required");
      return;
    }
    setTicketSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", ticketForm.name);
      formData.append("description", ticketForm.description);
      formData.append("propertyId", asset.propertyId);
      if (ticketForm.unitId) formData.append("unitId", ticketForm.unitId);
      if (ticketForm.dueDate) formData.append("dueDate", ticketForm.dueDate);
      formData.append("taskType", ticketForm.taskType);
      formData.append("subTaskType", ticketForm.subTaskType);
      if (ticketForm.departmentId) formData.append("departmentId", ticketForm.departmentId);
      formData.append("priority", ticketForm.priority);
      if (ticketForm.categoryId) formData.append("categoryId", ticketForm.categoryId);
      formData.append("assetIds", JSON.stringify([asset.id]));
      await ticketApi.create(formData);
      toast.success("Ticket created");
      setTicketOpen(false);
      fetchHistory(asset.id);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create ticket");
    } finally {
      setTicketSaving(false);
    }
  };

  if (loading) return <TableLoading />;

  if (error || !asset) return (
    <div className="py-12 text-center">
      <Package size={40} className={cls.emptyIcon} />
      <h1 className="mt-2 text-lg font-semibold text-gray-900">Asset Not Found</h1>
      <p className={`mt-1 ${cls.emptySub}`}>{error || "The asset you are looking for does not exist."}</p>
    </div>
  );

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Header */}
        <div className={`${cls.card} mb-3 p-4`}>
          <div className="flex items-start justify-between">
            <div>
              <h1 className={cls.pageTitle}>{asset.name}</h1>
              <p className={`mt-0.5 ${cls.mono}`}>{asset.code}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
                <button onClick={openTicketModal} className={cls.btnPrimary}>
                  <Plus size={13} />
                  Create Ticket
                </button>
              )}
              {canEdit && (
                <button onClick={openEdit} className={cls.btnSecondary}>
                  <Edit2 size={13} />
                  Edit
                </button>
              )}
              <ActiveBadge status={asset.status} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[13px] text-gray-500">
            <Building2 size={13} />
            <span>{asset.property?.name}</span>
            <span>/</span>
            <Layers size={13} />
            <span>{asset.floor?.name}</span>
          </div>
        </div>

        {/* Details */}
        <div className={`${cls.card} mb-3 p-4`}>
          <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Details</h2>
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <span className="text-[11px] text-gray-500">Category</span>
              <p className="font-medium">{asset.category?.name || "\u2014"}</p>
            </div>
            <div>
              <span className="text-[11px] text-gray-500">Condition</span>
              <p className="mt-0.5"><ConditionBadge condition={asset.condition} /></p>
            </div>
            <div>
              <span className="text-[11px] text-gray-500">Unit of Measure</span>
              <p className="font-medium">{asset.unitOfMeasure}</p>
            </div>
            {asset.serialNumber && (
              <div>
                <span className="text-[11px] text-gray-500">Serial Number</span>
                <p className="font-medium">{asset.serialNumber}</p>
              </div>
            )}
            {asset.purchaseDate && (
              <div>
                <span className="text-[11px] text-gray-500">Purchase Date</span>
                <p className="font-medium">{new Date(asset.purchaseDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
          {asset.additionalInfo && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              <span className="text-[11px] text-gray-500">Additional Information</span>
              <p className="mt-0.5 text-[13px]">{asset.additionalInfo}</p>
            </div>
          )}
        </div>

        {/* Ticket History */}
        <div className={`${cls.card} mb-3 p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
              <ClipboardList size={15} className="text-gray-400" />
              Ticket History
              {ticketHistory.length > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 py-px text-[11px] font-medium text-gray-600">{ticketHistory.length}</span>
              )}
            </h2>
          </div>
          {historyLoading ? (
            <TableLoading />
          ) : ticketHistory.length === 0 ? (
            <div className="py-6 text-center">
              <ClipboardList size={28} className={cls.emptyIcon} />
              <p className={`mt-1 ${cls.emptySub}`}>No tickets have been raised for this asset yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {ticketHistory.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cls.mono}>{ticket.ticketNumber}</span>
                      {ticket.isBlocked && <span className="inline-flex rounded-full bg-orange-100 px-1.5 py-px text-[10px] font-medium text-orange-700">Blocked</span>}
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <p className="mt-0.5 text-[13px] font-medium text-gray-800 truncate">{ticket.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {ticket.property?.name} · {ticket.assignedTo ? (ticket.assignedTo.fullName || ticket.assignedTo.username) : "Unassigned"}{ticket.dueDate ? ` · Due ${new Date(ticket.dueDate).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <Link to={`/tickets/${ticket.id}`} className={cls.btnIcon}>
                    <ExternalLink size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Image */}
        {asset.imagePath && (
          <div className={`${cls.card} mb-3 p-4`}>
            <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Image</h2>
            <img src={`/${asset.imagePath}`} alt={asset.name} className="w-full rounded-md object-cover" />
          </div>
        )}

        {/* QR Code */}
        <div className={`${cls.card} p-4 text-center`}>
          <h2 className="mb-3 text-[13px] font-semibold text-gray-900">QR Code</h2>
          {asset.qrCode ? (
            <>
              <img src={`/${asset.qrCode}`} alt="QR Code" className="mx-auto h-44 w-44" />
              <p className="mt-1.5 text-[11px] text-gray-500">Scan this QR code to view asset details</p>
              <a href={`/${asset.qrCode}`} download={`${asset.code}-qrcode.png`} className={`mt-2 ${cls.btnPrimary}`}>
                <Download size={14} />
                Download QR Code
              </a>
            </>
          ) : (
            <div className="py-4">
              <Package size={28} className={cls.emptyIcon} />
              <p className={`mt-1 ${cls.emptySub}`}>QR code has not been generated for this asset yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Asset">
        <div className="space-y-3">
          <div>
            <label className={cls.label}>Name</label>
            <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className={cls.input} />
          </div>
          <div>
            <label className={cls.label}>Category</label>
            <select value={editForm.categoryId} onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))} className={`w-full ${cls.select}`}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Condition</label>
              <select value={editForm.condition} onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))} className={`w-full ${cls.select}`}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className={cls.label}>Unit of Measure</label>
              <select value={editForm.unitOfMeasure} onChange={(e) => setEditForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} className={`w-full ${cls.select}`}>
                {UNITS_OF_MEASURE.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={cls.label}>Serial Number</label>
            <input value={editForm.serialNumber} onChange={(e) => setEditForm((f) => ({ ...f, serialNumber: e.target.value }))} className={cls.input} placeholder="Optional" />
          </div>
          <div>
            <label className={cls.label}>Additional Info</label>
            <textarea value={editForm.additionalInfo} onChange={(e) => setEditForm((f) => ({ ...f, additionalInfo: e.target.value }))} rows={3} className={cls.textarea} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditOpen(false)} className={cls.btnSecondary}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !editForm.name.trim()} className={cls.btnPrimary}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Ticket Modal */}
      <Modal isOpen={ticketOpen} onClose={() => setTicketOpen(false)} title="Create Ticket">
        <div className="space-y-3">
          {/* Asset pre-filled info */}
          <div className="rounded-md bg-gray-50 px-3 py-2 text-[13px]">
            <p className="text-gray-500">Asset</p>
            <p className="font-medium text-gray-800">{asset.name} <span className={cls.mono}>({asset.code})</span></p>
            <p className="text-[11px] text-gray-400 mt-0.5">{asset.property?.name}</p>
          </div>

          <div>
            <label className={cls.label}>Ticket Name <span className="text-red-500">*</span></label>
            <input value={ticketForm.name} onChange={(e) => setTicketForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Fridge not cooling" className={cls.input} />
          </div>

          <div>
            <label className={cls.label}>Description <span className="text-red-500">*</span></label>
            <textarea value={ticketForm.description} onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the issue..." className={cls.textarea} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Unit</label>
              <select value={ticketForm.unitId} onChange={(e) => setTicketForm((f) => ({ ...f, unitId: e.target.value }))} className={`w-full ${cls.select}`}>
                <option value="">Select unit...</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className={cls.label}>Due Date</label>
              <input type="date" value={ticketForm.dueDate} onChange={(e) => setTicketForm((f) => ({ ...f, dueDate: e.target.value }))} className={cls.input} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Task Type</label>
              <select value={ticketForm.taskType} onChange={(e) => setTicketForm((f) => ({ ...f, taskType: e.target.value }))} className={`w-full ${cls.select}`}>
                <option value="COMPLAIN">Complain</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INSPECT">Inspect</option>
                <option value="TASK">Task</option>
              </select>
            </div>
            <div>
              <label className={cls.label}>Sub Type</label>
              <select value={ticketForm.subTaskType} onChange={(e) => setTicketForm((f) => ({ ...f, subTaskType: e.target.value }))} className={`w-full ${cls.select}`}>
                <option value="REACTIVE">Reactive</option>
                <option value="PREVENTIVE">Preventive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Department</label>
              <select value={ticketForm.departmentId} onChange={(e) => setTicketForm((f) => ({ ...f, departmentId: e.target.value }))} className={`w-full ${cls.select}`}>
                <option value="">Select dept...</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={cls.label}>Priority</label>
              <select value={ticketForm.priority} onChange={(e) => setTicketForm((f) => ({ ...f, priority: e.target.value }))} className={`w-full ${cls.select}`}>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className={cls.label}>Category <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={ticketForm.categoryId} onChange={(e) => setTicketForm((f) => ({ ...f, categoryId: e.target.value }))} className={`w-full ${cls.select}`}>
              <option value="">Select category...</option>
              {ticketCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setTicketOpen(false)} className={cls.btnSecondary}>Cancel</button>
            <button onClick={handleCreateTicket} disabled={ticketSaving} className={cls.btnPrimary}>
              {ticketSaving ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
