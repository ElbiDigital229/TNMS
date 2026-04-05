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
import { ArrowLeft } from "lucide-react";

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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState("");
  const [recurringDay, setRecurringDay] = useState("");
  const [recurringDueDays, setRecurringDueDays] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");

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
      setIsRecurring(t.isRecurring);
      setRecurringType(t.recurringType || "");
      setRecurringDay(t.recurringDay?.toString() || "");
      setRecurringDueDays(t.recurringDueDays?.toString() || "");
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
    if (
      !name ||
      !description ||
      !propertyId ||
      !unitId ||
      !dueDate ||
      !taskType ||
      !subTaskType ||
      !departmentId ||
      !priority
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("propertyId", propertyId);
    formData.append("unitId", unitId);
    formData.append("dueDate", dueDate);
    formData.append("taskType", taskType);
    formData.append("subTaskType", subTaskType);
    if (categoryId) formData.append("categoryId", categoryId);
    formData.append("departmentId", departmentId);
    if (assignedToId) formData.append("assignedToId", assignedToId);
    formData.append("priority", priority);
    formData.append("isRecurring", String(isRecurring));
    if (isRecurring && recurringType) {
      formData.append("recurringType", recurringType);
      if (recurringDay) formData.append("recurringDay", recurringDay);
      if (recurringDueDays)
        formData.append("recurringDueDays", recurringDueDays);
    }
    if (selectedAssetIds.length > 0) {
      formData.append("assetIds", JSON.stringify(selectedAssetIds));
    }
    if (image) formData.append("image", image);

    try {
      if (isEdit) {
        await ticketApi.update(id!, formData);
        toast.success("Ticket updated");
      } else {
        await ticketApi.create(formData);
        toast.success("Ticket created");
      }
      navigate("/tickets");
    } catch {
      toast.error(isEdit ? "Failed to update ticket" : "Failed to create ticket");
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
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-150"
      >
        <ArrowLeft size={16} />
        Back to Tickets
      </button>

      <h1 className="mb-6 text-lg font-semibold text-gray-900">
        {isEdit ? "Edit Ticket" : "Create Ticket"}
      </h1>

      <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
        <div className="space-y-4">
          {/* Ticket Name */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Ticket Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter ticket name"
            />
          </div>

          {/* Property */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Property <span className="text-red-500">*</span>
            </label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              disabled={isEdit}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:bg-gray-100"
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
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Unit <span className="text-red-500">*</span>
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={!propertyId}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:bg-gray-100"
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
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Tag Assets
                {selectedAssetIds.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                    {selectedAssetIds.length} selected
                  </span>
                )}
                <span className="ml-1 text-gray-400">(optional)</span>
              </label>
              <div className="rounded-lg ring-1 ring-gray-200 shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-3 py-2">
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search assets by name or code..."
                    className="w-full text-sm bg-transparent outline-none placeholder-gray-400"
                  />
                </div>
                <div className="max-h-48 space-y-0.5 overflow-y-auto p-2">
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
                      <p className="px-2 py-3 text-center text-[13px] text-gray-400">
                        No assets found
                      </p>
                    ) : (
                      filtered.map((asset) => (
                        <label
                          key={asset.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                            selectedAssetIds.includes(asset.id)
                              ? "bg-primary-50"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAssetIds.includes(asset.id)}
                            onChange={() => toggleAsset(asset.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="font-mono text-xs text-primary-600">
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
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Describe the ticket..."
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Due Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            />
          </div>

          {/* Task Type & Sub Task Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Task Type <span className="text-red-500">*</span>
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              >
                <option value="">Select type</option>
                <option value="COMPLAIN">Complain</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="INSPECT">Inspect</option>
                <option value="TASK">Task</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Sub Task Type <span className="text-red-500">*</span>
              </label>
              <select
                value={subTaskType}
                onChange={(e) => setSubTaskType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              >
                <option value="">Select sub type</option>
                <option value="REACTIVE">Reactive</option>
                <option value="PREVENTIVE">Preventive</option>
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => { setDepartmentId(e.target.value); setAssignedToId(""); }}
              disabled={isEdit}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:bg-gray-100"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Assign To */}
          {departmentId && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Assign To <span className="text-gray-400">(optional)</span>
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Category <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
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
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              >
                <option value="">Select priority</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Recurring */}
          <div className="rounded-xl ring-1 ring-gray-200 p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked);
                  if (!e.target.checked) {
                    setRecurringType("");
                    setRecurringDay("");
                    setRecurringDueDays("");
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Is this a recurring ticket?
              </span>
            </label>

            {isRecurring && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                    Recurring Frequency
                  </label>
                  <select
                    value={recurringType}
                    onChange={(e) => {
                      setRecurringType(e.target.value);
                      setRecurringDay("");
                      setRecurringDueDays("");
                    }}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  >
                    <option value="">Select frequency</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                {recurringType === "MONTHLY" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                        Day of Month (1-28)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={recurringDay}
                        onChange={(e) => setRecurringDay(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                        Days until due (max 15)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={recurringDueDays}
                        onChange={(e) => setRecurringDueDays(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      />
                    </div>
                  </div>
                )}

                {recurringType === "WEEKLY" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                        Day of Week
                      </label>
                      <select
                        value={recurringDay}
                        onChange={(e) => setRecurringDay(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      >
                        <option value="">Select day</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                        <option value="7">Sunday</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                        Days until due (max 7)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={recurringDueDays}
                        onChange={(e) => setRecurringDueDays(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                      />
                    </div>
                  </div>
                )}

                {recurringType === "DAILY" && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                      Due date
                    </label>
                    <select
                      value={recurringDueDays}
                      onChange={(e) => setRecurringDueDays(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    >
                      <option value="">Select</option>
                      <option value="0">Same day</option>
                      <option value="1">Next day</option>
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Image */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Upload Image <span className="text-gray-400">(optional)</span>
            </label>
            {image ? (
              <div className="relative mt-1">
                <img
                  src={URL.createObjectURL(image)}
                  alt="Preview"
                  className="max-h-48 w-full rounded-lg object-cover ring-1 ring-gray-200"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                  title="Remove image"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            ) : (
              <label className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-8 transition-colors hover:border-primary-300 hover:bg-primary-50/30 active:bg-primary-50/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImage(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-gray-300"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                <p className="text-sm text-gray-400">Tap to upload photo</p>
              </label>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button
              onClick={() => navigate("/tickets")}
              className="rounded-lg bg-white shadow-sm ring-1 ring-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 shadow-sm transition-all duration-200"
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
