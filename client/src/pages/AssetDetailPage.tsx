import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { assetApi, assetCategoryApi, ticketApi, departmentApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import { CONDITION_LABELS, TICKET_STATUS_LABELS, PRIORITY_LABELS } from "../../../shared/types";
import { PERMISSIONS } from "../../../shared/permissions";
import { ArrowLeft, Building2, Download, Edit2, Layers, Package, Plus, ClipboardList, ExternalLink } from "lucide-react";
import api from "../lib/api";

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;
const UNITS_OF_MEASURE = ["NOS", "MTR", "SFT", "SET", "LOT", "KG", "LTR", "PKT", "BOX", "ROLL"] as const;

const statusColor = (s: string) => {
  switch (s) {
    case "OPEN": return "bg-blue-50 text-blue-600";
    case "IN_PROGRESS": return "bg-yellow-50 text-yellow-600";
    case "OVERDUE": return "bg-red-100 text-red-700";
    case "COMPLETED": return "bg-green-50 text-green-600";
    default: return "bg-gray-100 text-gray-600";
  }
};

const priorityColor = (p: string) => {
  switch (p) {
    case "CRITICAL": return "bg-red-50 text-red-600";
    case "HIGH": return "bg-orange-50 text-orange-600";
    case "MEDIUM": return "bg-yellow-50 text-yellow-600";
    case "LOW": return "bg-blue-50 text-blue-600";
    default: return "bg-gray-100 text-gray-700";
  }
};

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
    // Load units, departments, ticket categories
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
    if (!ticketForm.name.trim() || !ticketForm.description.trim() || !ticketForm.unitId || !ticketForm.dueDate || !ticketForm.departmentId) {
      toast.error("Please fill all required fields");
      return;
    }
    setTicketSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", ticketForm.name);
      formData.append("description", ticketForm.description);
      formData.append("propertyId", asset.propertyId);
      formData.append("unitId", ticketForm.unitId);
      formData.append("dueDate", ticketForm.dueDate);
      formData.append("taskType", ticketForm.taskType);
      formData.append("subTaskType", ticketForm.subTaskType);
      formData.append("departmentId", ticketForm.departmentId);
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

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
    </div>
  );

  if (error || !asset) return (
    <div className="py-12 text-center">
      <Package size={48} className="mx-auto text-gray-300" />
      <h1 className="mt-3 text-xl font-semibold text-gray-900">Asset Not Found</h1>
      <p className="mt-1 text-[13px] text-gray-500">{error || "The asset you are looking for does not exist."}</p>
    </div>
  );

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Header */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{asset.name}</h1>
              <p className="mt-1 font-mono text-sm text-primary-600">{asset.code}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasPermission(PERMISSIONS.TICKETS.CREATE) && (
                <button
                  onClick={openTicketModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                >
                  <Plus size={13} />
                  Create Ticket
                </button>
              )}
              {canEdit && (
                <button
                  onClick={openEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <Edit2 size={13} />
                  Edit
                </button>
              )}
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${asset.status === "ACTIVE" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                {asset.status}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Building2 size={14} />
            <span>{asset.property?.name}</span>
            <span>/</span>
            <Layers size={14} />
            <span>{asset.floor?.name}</span>
          </div>
        </div>

        {/* Details */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[13px] text-gray-500">Category</span>
              <p className="font-medium">{asset.category?.name || "—"}</p>
            </div>
            <div>
              <span className="text-[13px] text-gray-500">Condition</span>
              <p className="font-medium">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${asset.condition === "EXCELLENT" ? "bg-green-50 text-green-600" : asset.condition === "GOOD" ? "bg-blue-50 text-blue-600" : asset.condition === "FAIR" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-600"}`}>
                  {CONDITION_LABELS[asset.condition]}
                </span>
              </p>
            </div>
            <div>
              <span className="text-[13px] text-gray-500">Unit of Measure</span>
              <p className="font-medium">{asset.unitOfMeasure}</p>
            </div>
            {asset.serialNumber && (
              <div>
                <span className="text-[13px] text-gray-500">Serial Number</span>
                <p className="font-medium">{asset.serialNumber}</p>
              </div>
            )}
            {asset.purchaseDate && (
              <div>
                <span className="text-[13px] text-gray-500">Purchase Date</span>
                <p className="font-medium">{new Date(asset.purchaseDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
          {asset.additionalInfo && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <span className="text-[13px] text-gray-500">Additional Information</span>
              <p className="mt-1 text-sm">{asset.additionalInfo}</p>
            </div>
          )}
        </div>

        {/* Ticket History */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ClipboardList size={18} className="text-gray-400" />
              Ticket History
              {ticketHistory.length > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{ticketHistory.length}</span>
              )}
            </h2>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
            </div>
          ) : ticketHistory.length === 0 ? (
            <div className="py-8 text-center">
              <ClipboardList size={32} className="mx-auto text-gray-200" />
              <p className="mt-2 text-sm text-gray-400">No tickets have been raised for this asset yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {ticketHistory.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-primary-600">{ticket.ticketNumber}</span>
                      {ticket.isBlocked && <span className="inline-flex rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">Blocked</span>}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(ticket.status)}`}>{TICKET_STATUS_LABELS[ticket.status] || ticket.status}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColor(ticket.priority)}`}>{PRIORITY_LABELS[ticket.priority]}</span>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-gray-800 truncate">{ticket.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ticket.property?.name} · {ticket.assignedTo ? (ticket.assignedTo.fullName || ticket.assignedTo.username) : "Unassigned"} · Due {new Date(ticket.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Link to={`/tickets/${ticket.id}`} className="ml-4 flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                    <ExternalLink size={15} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Image */}
        {asset.imagePath && (
          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Image</h2>
            <img src={`/${asset.imagePath}`} alt={asset.name} className="w-full rounded-lg object-cover" />
          </div>
        )}

        {/* QR Code */}
        <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-950/5">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">QR Code</h2>
          {asset.qrCode ? (
            <>
              <img src={`/${asset.qrCode}`} alt="QR Code" className="mx-auto h-48 w-48" />
              <p className="mt-2 text-[13px] text-gray-500">Scan this QR code to view asset details</p>
              <a href={`/${asset.qrCode}`} download={`${asset.code}-qrcode.png`} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700">
                <Download size={16} />
                Download QR Code
              </a>
            </>
          ) : (
            <div className="py-4">
              <Package size={32} className="mx-auto text-gray-300" />
              <p className="mt-2 text-[13px] text-gray-500">QR code has not been generated for this asset yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Asset">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Name</label>
            <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Category</label>
            <select value={editForm.categoryId} onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Condition</label>
              <select value={editForm.condition} onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Unit of Measure</label>
              <select value={editForm.unitOfMeasure} onChange={(e) => setEditForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                {UNITS_OF_MEASURE.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Serial Number</label>
            <input value={editForm.serialNumber} onChange={(e) => setEditForm((f) => ({ ...f, serialNumber: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" placeholder="Optional" />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Additional Info</label>
            <textarea value={editForm.additionalInfo} onChange={(e) => setEditForm((f) => ({ ...f, additionalInfo: e.target.value }))} rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setEditOpen(false)} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving || !editForm.name.trim()} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Ticket Modal */}
      <Modal isOpen={ticketOpen} onClose={() => setTicketOpen(false)} title="Create Ticket">
        <div className="space-y-4">
          {/* Asset pre-filled info */}
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
            <p className="text-gray-500">Asset</p>
            <p className="font-medium text-gray-800">{asset.name} <span className="font-mono text-xs text-primary-600">({asset.code})</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{asset.property?.name}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Ticket Name <span className="text-red-500">*</span></label>
            <input value={ticketForm.name} onChange={(e) => setTicketForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Fridge not cooling" className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Description <span className="text-red-500">*</span></label>
            <textarea value={ticketForm.description} onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the issue..." className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Unit <span className="text-red-500">*</span></label>
              <select value={ticketForm.unitId} onChange={(e) => setTicketForm((f) => ({ ...f, unitId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                <option value="">Select unit...</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Due Date <span className="text-red-500">*</span></label>
              <input type="date" value={ticketForm.dueDate} onChange={(e) => setTicketForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Task Type <span className="text-red-500">*</span></label>
              <select value={ticketForm.taskType} onChange={(e) => setTicketForm((f) => ({ ...f, taskType: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                <option value="COMPLAIN">Complain</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INSPECT">Inspect</option>
                <option value="TASK">Task</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Sub Type <span className="text-red-500">*</span></label>
              <select value={ticketForm.subTaskType} onChange={(e) => setTicketForm((f) => ({ ...f, subTaskType: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                <option value="REACTIVE">Reactive</option>
                <option value="PREVENTIVE">Preventive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Department <span className="text-red-500">*</span></label>
              <select value={ticketForm.departmentId} onChange={(e) => setTicketForm((f) => ({ ...f, departmentId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                <option value="">Select dept...</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Priority <span className="text-red-500">*</span></label>
              <select value={ticketForm.priority} onChange={(e) => setTicketForm((f) => ({ ...f, priority: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Category <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={ticketForm.categoryId} onChange={(e) => setTicketForm((f) => ({ ...f, categoryId: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100">
              <option value="">Select category...</option>
              {ticketCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setTicketOpen(false)} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button>
            <button onClick={handleCreateTicket} disabled={ticketSaving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50">
              {ticketSaving ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
