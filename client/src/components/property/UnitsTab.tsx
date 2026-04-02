import { useState, useEffect } from "react";
import { unitApi, floorApi } from "../../lib/api";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import BulkImportModal from "../ui/BulkImportModal";
import { Plus, Pencil, Building2, Upload, Trash2, Download } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { PERMISSIONS } from "../../../../shared/permissions";

interface Unit {
  id: string;
  code: string;
  name: string;
  unitType: string | null;
  description: string | null;
  status: string;
  floor: { id: string; name: string } | null;
}

interface Floor {
  id: string;
  name: string;
  status: string;
}

interface UnitsTabProps {
  propertyId: string;
  propertyName?: string;
  onUpdate: () => void;
}

export default function UnitsTab({ propertyId, propertyName, onUpdate }: UnitsTabProps) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const P = PERMISSIONS;
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState("");
  const [floorId, setFloorId] = useState("");
  const [description, setDescription] = useState("");

  const fetchData = () => {
    Promise.all([
      unitApi.list(propertyId),
      floorApi.list(propertyId),
    ])
      .then(([unitsRes, floorsRes]) => {
        setUnits(unitsRes.data.data);
        setFloors(floorsRes.data.data.filter((f: Floor) => f.status === "ACTIVE"));
        setSelectedIds(new Set());
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const openAdd = () => {
    setEditingUnit(null);
    setName("");
    setUnitType("");
    setFloorId("");
    setDescription("");
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setUnitType(unit.unitType || "");
    setFloorId(unit.floor?.id || "");
    setDescription(unit.description || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("Please fill the required field: Unit Name");
      return;
    }

    try {
      const payload = {
        name,
        unitType: unitType || undefined,
        floorId: floorId || undefined,
        description: description || undefined,
      };
      if (editingUnit) {
        await unitApi.update(editingUnit.id, payload);
        toast.success("Unit updated");
      } else {
        await unitApi.create(propertyId, payload);
        toast.success("Unit created");
      }
      setModalOpen(false);
      fetchData();
      onUpdate();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Failed to save unit";
      toast.error(msg);
    }
  };

  const handleToggleStatus = async (unit: Unit) => {
    try {
      if (unit.status === "ACTIVE") {
        await unitApi.deactivate(unit.id);
        toast.success("Unit deactivated");
      } else {
        await unitApi.activate(unit.id);
        toast.success("Unit activated");
      }
      fetchData();
      onUpdate();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === units.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(units.map((u) => u.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} unit${count > 1 ? "s" : ""}? This will also delete all associated assets and tickets.`)) return;

    setDeleting(true);
    try {
      await unitApi.bulkDelete(Array.from(selectedIds));
      toast.success(`${count} unit${count > 1 ? "s" : ""} deleted`);
      fetchData();
      onUpdate();
    } catch {
      toast.error("Failed to delete units");
    } finally {
      setDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          {selectedIds.size > 0 && hasPermission(P.UNITS.DEACTIVATE) && (
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deleting ? "Deleting..." : `Delete ${selectedIds.size} selected`}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {units.length > 0 && hasPermission(P.UNITS.EXPORT) && (
            <button
              onClick={() => {
                const escape = (v: any) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
                const rows = [["Code", "Name", "Type", "Floor", "Status"], ...units.map(u => [u.code, u.name, u.unitType ?? "", u.floor?.name ?? "", u.status])];
                const csv = rows.map(r => r.map(escape).join(",")).join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = `${propertyName ?? "property"}_units.csv`;
                a.click();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <Download size={16} />
              Export
            </button>
          )}
          {hasPermission(P.UNITS.IMPORT) && (
            <button
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              <Upload size={16} />
              Bulk Import
            </button>
          )}
          {hasPermission(P.UNITS.CREATE) && (
            <button
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
            >
              <Plus size={16} />
              Add Unit
            </button>
          )}
        </div>
      </div>

      {units.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Building2 size={48} className="mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No units added yet</p>
          <p className="mt-1 text-sm text-gray-400">Add your first unit to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === units.length && units.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Code</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Floor</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Type</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className={`border-b border-gray-100/80 transition-colors duration-150 hover:bg-gray-50/80 ${selectedIds.has(unit.id) ? "bg-primary-50/40" : ""}`}>
                  <td className="px-3 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(unit.id)}
                      onChange={() => toggleSelect(unit.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-primary-600">{unit.code}</td>
                  <td className="px-5 py-3.5 font-medium">{unit.name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{unit.floor?.name || "—"}</td>
                  <td className="px-5 py-3.5 text-gray-600">{unit.unitType || "—"}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${unit.status === "ACTIVE" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                      {unit.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      {hasPermission(P.UNITS.EDIT) && (
                        <button onClick={() => openEdit(unit)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <Pencil size={16} />
                        </button>
                      )}
                      {hasPermission(P.UNITS.DEACTIVATE) && (
                        <button
                          onClick={() => handleToggleStatus(unit)}
                          className={`rounded px-2 py-0.5 text-xs font-medium ${unit.status === "ACTIVE" ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                        >
                          {unit.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUnit ? "Edit Unit" : "Add Unit"}
      >
        <div className="space-y-4">
          {editingUnit && (
            <div className="rounded-lg bg-gray-50 px-4 py-2">
              <span className="text-sm text-gray-500">Unit Code: </span>
              <span className="font-mono text-sm font-bold text-primary-600">{editingUnit.code}</span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Unit Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter unit name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Select Floor
            </label>
            <select
              value={floorId}
              onChange={(e) => setFloorId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select floor</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Unit Type
            </label>
            <input
              type="text"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="e.g. Office, Retail, Storage"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Additional Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Optional description..."
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
            >
              {editingUnit ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <BulkImportModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Import Units"
        columns={[
          { key: "name", label: "Name", required: true, example: "Unit 101" },
          { key: "unitType", label: "Unit Type", required: false, example: "Office" },
          { key: "floorName", label: "Floor Name", required: false, example: "Ground Floor" },
          { key: "description", label: "Description", required: false, example: "Corner unit" },
        ]}
        onImport={async (items) => {
          const res = await unitApi.bulkImport(propertyId, items);
          return res.data.data;
        }}
        onComplete={() => {
          fetchData();
          onUpdate();
        }}
      />
    </div>
  );
}
