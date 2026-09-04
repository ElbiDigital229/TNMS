import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ticketApi,
  ticketCategoryApi,
  propertyApi,
  unitApi,
  assetApi,
  departmentApi,
} from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import PageHeader from "../components/ui/PageHeader";
import { ArrowLeft } from "lucide-react";
import { cls } from "../lib/styles";
import { capture } from "../lib/posthog";
import { compressImages } from "../lib/compressImage";
import { uploadErrorMessage } from "../lib/uploadError";

interface Property {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface UnitItem {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface AssetItem {
  id: string;
  name: string;
  code: string;
  status: string;
}

interface Category {
  id: string;
  name: string;
  status: string;
}

interface Department {
  id: string;
  name: string;
  status: string;
}

interface DeptUser {
  id: string;
  fullName: string | null;
  username: string;
  role: { id: string; name: string };
}

export default function TicketFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canAssign = hasPermission(PERMISSIONS.TICKETS.ASSIGN);

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [taskType, setTaskType] = useState("");
  const [subTaskType, setSubTaskType] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [deptUsers, setDeptUsers] = useState<DeptUser[]>([]);
  const [assignedToId, setAssignedToId] = useState("");
  const [priority, setPriority] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  // PPM toggle + selection
  const [isPpm, setIsPpm] = useState(false);
  const [ppmId, setPpmId] = useState("");
  const [ppms, setPpms] = useState<{ id: string; name: string }[]>([]);

  // Load properties, categories, and departments
  useEffect(() => {
    Promise.all([
      propertyApi.list({ limit: 100, status: "ACTIVE" }),
      ticketCategoryApi.list(),
      departmentApi.list(),
    ])
      .then(([propRes, catRes, deptRes]) => {
        setProperties(propRes.data.data.data);
        setCategories(
          catRes.data.data.filter((c: Category) => c.status === "ACTIVE")
        );
        setDepartments(deptRes.data.data.filter((d: Department) => d.status === "ACTIVE"));
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoadingData(false));

    // PPMs (best-effort — user may not have PPM.VIEW; silently skip)
    import("../lib/api").then(({ ppmApi }) => {
      ppmApi.list({ status: "ACTIVE" })
        .then((r) => setPpms(r.data.data.map((p: any) => ({ id: p.id, name: p.name }))))
        .catch(() => {});
    });
  }, []);

  // Load ticket data for edit mode
  useEffect(() => {
    if (!id) return;
    ticketApi.getById(id).then((res) => {
      const t = res.data.data;
      setName(t.name);
      setDescription(t.description);
      setPropertyId(t.propertyId);
      setUnitId(t.unitId);
      setSelectedAssetIds(t.assets?.map((a: any) => a.assetId) || []);
      setDueDate(new Date(t.dueDate).toISOString().split("T")[0]);
      setTaskType(t.taskType);
      setSubTaskType(t.subTaskType);
      setCategoryId(t.categoryId);
      setDepartmentId(t.departmentId);
      setAssignedToId(t.assignedToId || "");
      setPriority(t.priority);
      if (t.ppmId) {
        setIsPpm(true);
        setPpmId(t.ppmId);
      }
    });
  }, [id]);

  // Load department users when departmentId changes
  useEffect(() => {
    if (!departmentId) { setDeptUsers([]); setAssignedToId(""); return; }
    departmentApi.getUsers(departmentId).then((res) => setDeptUsers(res.data.data));
  }, [departmentId]);

  // Load units when property changes
  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setUnitId("");
      setAssets([]);
      setSelectedAssetIds([]);
      return;
    }
    unitApi.list(propertyId).then((res) => {
      setUnits(
        res.data.data.filter((u: UnitItem) => u.status === "ACTIVE")
      );
    });
  }, [propertyId]);

  // Load assets when property changes
  useEffect(() => {
    if (!propertyId) {
      setAssets([]);
      if (!isEdit) setSelectedAssetIds([]);
      return;
    }
    assetApi.listByProperty(propertyId).then((res) => {
      setAssets(
        res.data.data.filter((a: AssetItem) => a.status === "ACTIVE")
      );
    });
  }, [propertyId]);

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
    );
  };

  const handleSubmit = async () => {
    if (!name || !description || !propertyId || !departmentId) {
      toast.error("Title, description, property, and department are required");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("propertyId", propertyId);
    if (unitId) formData.append("unitId", unitId);
    if (dueDate) formData.append("dueDate", dueDate);
    if (taskType) formData.append("taskType", taskType);
    if (subTaskType) formData.append("subTaskType", subTaskType);
    if (categoryId) formData.append("categoryId", categoryId);
    formData.append("departmentId", departmentId);
    if (assignedToId) formData.append("assignedToId", assignedToId);
    if (priority) formData.append("priority", priority);
    if (selectedAssetIds.length > 0) {
      formData.append("assetIds", JSON.stringify(selectedAssetIds));
    }
    if (isPpm && ppmId) formData.append("ppmId", ppmId);
    // Downscale before attaching — nginx caps the whole request at 10MB and
    // camera photos are several MB each. See lib/compressImage.ts.
    const compressed = await compressImages(images);
    compressed.forEach((img) => formData.append("images", img));

    try {
      if (isEdit) {
        await ticketApi.update(id!, formData);
        capture("ticket_updated", { ticket_id: id });
        toast.success("Ticket updated");
      } else {
        const res = await ticketApi.create(formData);
        capture("ticket_created", {
          ticket_id: res?.data?.data?.id,
          priority: formData.get("priority"),
          task_type: formData.get("taskType"),
          property_id: formData.get("propertyId"),
        });
        toast.success("Ticket created");
      }
      navigate("/tickets");
    } catch (err: any) {
      const fallback = isEdit ? "Failed to update ticket" : "Failed to create ticket";
      const message = uploadErrorMessage(err);
      toast.error(message === "Failed to upload image" ? fallback : message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate("/tickets")}
        className="mb-3 flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Tickets
      </button>

      <PageHeader title={isEdit ? "Edit Ticket" : "Create Ticket"} />

      <div className={`mx-auto max-w-2xl ${cls.card} p-4`}>
        <div className="space-y-3">
          {/* Ticket Name */}
          <div>
            <label className={cls.label}>
              Ticket Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls.input}
              placeholder="Enter ticket name"
            />
          </div>

          {/* Property */}
          <div>
            <label className={cls.label}>
              Property <span className="text-red-500">*</span>
            </label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              disabled={isEdit}
              className={`w-full ${cls.select} disabled:bg-gray-100`}
            >
              <option value="">Select property</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <label className={cls.label}>
              Unit
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={!propertyId}
              className={`w-full ${cls.select} disabled:bg-gray-100`}
            >
              <option value="">Select unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          {/* Assets (optional, multi-select with search) */}
          {propertyId && assets.length > 0 && (
            <div>
              <label className={cls.label}>
                Tag Assets
                {selectedAssetIds.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 px-1.5 py-px text-[11px] font-medium text-primary-700">
                    {selectedAssetIds.length} selected
                  </span>
                )}
                <span className="ml-1 text-gray-400">(optional)</span>
              </label>
              <div className="rounded-md ring-1 ring-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 px-2.5 py-1.5">
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search assets by name or code..."
                    className="w-full text-[13px] bg-transparent outline-none placeholder-gray-400"
                  />
                </div>
                <div className="max-h-40 space-y-0.5 overflow-y-auto p-1.5">
                  {(() => {
                    const q = assetSearch.toLowerCase();
                    const filtered = q
                      ? assets.filter(
                          (a) =>
                            a.name.toLowerCase().includes(q) ||
                            a.code.toLowerCase().includes(q)
                        )
                      : assets;
                    return filtered.length === 0 ? (
                      <p className="px-2 py-2 text-center text-[13px] text-gray-400">
                        No assets found
                      </p>
                    ) : (
                      filtered.map((asset) => (
                        <label
                          key={asset.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors ${
                            selectedAssetIds.includes(asset.id)
                              ? "bg-primary-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssetIds.includes(asset.id)}
                            onChange={() => toggleAsset(asset.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="font-mono text-[11px] text-primary-600">
                            {asset.code}
                          </span>
                          <span>{asset.name}</span>
                        </label>
                      ))
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className={cls.label}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={cls.textarea}
              placeholder="Describe the ticket..."
            />
          </div>

          {/* Due Date */}
          <div>
            <label className={cls.label}>
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={cls.input}
            />
          </div>

          {/* PPM (Planned Preventive Maintenance) */}
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-[13px] text-gray-800">
              <input
                type="checkbox"
                checked={isPpm}
                onChange={(e) => {
                  setIsPpm(e.target.checked);
                  if (!e.target.checked) setPpmId("");
                  // PPM implies Preventive maintenance
                  if (e.target.checked) {
                    setTaskType("MAINTENANCE");
                    setSubTaskType("PREVENTIVE");
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="font-medium">Is this a PPM?</span>
              <span className="text-[11px] text-gray-500">Planned Preventive Maintenance — attaches a checklist to the ticket.</span>
            </label>
            {isPpm && (
              <div className="mt-2">
                <label className={cls.label}>Select PPM Checklist <span className="text-red-500">*</span></label>
                <select
                  value={ppmId}
                  onChange={(e) => setPpmId(e.target.value)}
                  className={`w-full ${cls.select}`}
                  disabled={isEdit}
                >
                  <option value="">Select a PPM…</option>
                  {ppms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {isEdit && (
                  <p className="mt-1 text-[11px] text-gray-500">PPM can't be changed on an existing ticket — the checklist is snapshotted at creation.</p>
                )}
              </div>
            )}
          </div>

          {/* Task Type & Sub Task Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>
                Task Type
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className={`w-full ${cls.select}`}
              >
                <option value="">Select type</option>
                <option value="COMPLAIN">Complain</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INSPECT">Inspect</option>
                <option value="TASK">Task</option>
              </select>
            </div>
            <div>
              <label className={cls.label}>
                Sub Task Type
              </label>
              <select
                value={subTaskType}
                onChange={(e) => setSubTaskType(e.target.value)}
                className={`w-full ${cls.select}`}
              >
                <option value="">Select sub type</option>
                <option value="REACTIVE">Reactive</option>
                <option value="PREVENTIVE">Preventive</option>
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label className={cls.label}>
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => { setDepartmentId(e.target.value); setAssignedToId(""); }}
              className={`w-full ${cls.select}`}
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {isEdit && (
              <p className="mt-1 text-[11px] text-gray-500">
                Changing the department will clear the assignee if they don't belong to the new department.
              </p>
            )}
          </div>

          {/* Assign To */}
          {departmentId && (
            <div>
              <label className={cls.label}>
                Assign To <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className={`w-full ${cls.select}`}
              >
                <option value="">Leave unassigned</option>
                {deptUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.username} ({u.role.name})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>
                Category <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`w-full ${cls.select}`}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={cls.label}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={`w-full ${cls.select}`}
              >
                <option value="">Select priority</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Images */}
          <div>
            <label className={cls.label}>
              Upload Photos <span className="text-gray-400">(optional, up to 5)</span>
            </label>
            {images.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative">
                    <img
                      src={URL.createObjectURL(img)}
                      alt={`Preview ${i + 1}`}
                      className="h-20 w-20 rounded-md object-cover ring-1 ring-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                      title="Remove image"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < 5 && (
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-200 py-6 transition-colors hover:border-primary-300 hover:bg-primary-50/30 active:bg-primary-50/50">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setImages((prev) => [...prev, ...files].slice(0, 5));
                    e.target.value = "";
                  }}
                  className="hidden"
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-1.5 text-gray-300"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                <p className="text-[13px] text-gray-400">
                  {images.length === 0 ? "Tap to upload photos" : `Add more (${images.length}/5)`}
                </p>
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              onClick={() => navigate("/tickets")}
              className={cls.btnSecondary}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={cls.btnPrimary}
            >
              {saving
                ? "Saving..."
                : isEdit
                  ? "Update Ticket"
                  : "Create Ticket"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
