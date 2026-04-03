import { useState, useEffect } from "react";
import { floorApi } from "../../lib/api";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import BulkImportModal from "../ui/BulkImportModal";
import { Plus, Pencil, Layers, Download, Upload, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { PERMISSIONS } from "../../../../shared/permissions";

interface Floor {
  id: string;
  name: string;
  status: string;
}

interface FloorsTabProps {
  propertyId: string;
  propertyName?: string;
  onUpdate: () => void;
}

export default function FloorsTab({ propertyId, propertyName, onUpdate }: FloorsTabProps) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const P = PERMISSIONS;
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [floorName, setFloorName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchFloors = () => {
    floorApi
      .list(propertyId)
      .then((res) => { setFloors(res.data.data); setSelectedIds(new Set()); })
      .catch(() => toast.error("Failed to load floors"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFloors();
  }, [propertyId]);

  const openAdd = () => {
    setEditingFloor(null);
    setFloorName("");
    setModalOpen(true);
  };

  const openEdit = (floor: Floor) => {
    setEditingFloor(floor);
    setFloorName(floor.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!floorName.trim()) {
      toast.error("Floor name is required");
      return;
    }

    try {
      if (editingFloor) {
        await floorApi.update(editingFloor.id, floorName);
        toast.success("Floor updated");
      } else {
        await floorApi.create(propertyId, floorName);
        toast.success("Floor created");
      }
      setModalOpen(false);
      fetchFloors();
      onUpdate();
    } catch {
      toast.error("Failed to save floor");
    }
  };

  const handleToggleStatus = async (floor: Floor) => {
    try {
      if (floor.status === "ACTIVE") {
        await floorApi.deactivate(floor.id);
        toast.success("Floor deactivated");
      } else {
        await floorApi.activate(floor.id);
        toast.success("Floor activated");
      }
      fetchFloors();
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
    if (selectedIds.size === floors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(floors.map((f) => f.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} floor${count > 1 ? "s" : ""}? This will also delete all associated units and assets.`)) return;

    setDeleting(true);
    try {
      await floorApi.bulkDelete(Array.from(selectedIds));
      toast.success(`${count} floor${count > 1 ? "s" : ""} deleted`);
      fetchFloors();
      onUpdate();
    } catch {
      toast.error("Failed to delete floors");
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
          {selectedIds.size > 0 && hasPermission(P.FLOORS.DELETE) && (
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
        {floors.length > 0 && hasPermission(P.FLOORS.VIEW) && (
          <button
            onClick={() => {
              const escape = (v: any) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
              const rows = [["Floor Name", "Status"], ...floors.map(f => [f.name, f.status])];
              const csv = rows.map(r => r.map(escape).join(",")).join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = `${propertyName ?? "property"}_floors.csv`;
              a.click();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <Download size={16} />
            Export
          </button>
        )}
        {hasPermission(P.FLOORS.IMPORT) && (
          <button
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <Upload size={16} />
            Import
          </button>
        )}
        {hasPermission(P.FLOORS.CREATE) && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
          >
            <Plus size={16} />
            Add Floor
          </button>
        )}
        </div>
      </div>

      {floors.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Layers size={48} className="mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No floors added yet</p>
          <p className="mt-1 text-sm text-gray-400">Add your first floor to get started</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === floors.length && floors.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Floor Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {floors.map((floor) => (
              <tr key={floor.id} className={`border-b border-gray-100/80 transition-colors duration-150 hover:bg-gray-50/80 ${selectedIds.has(floor.id) ? "bg-primary-50/40" : ""}`}>
                <td className="px-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(floor.id)}
                    onChange={() => toggleSelect(floor.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className="px-5 py-3.5 font-medium">{floor.name}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${floor.status === "ACTIVE" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                    {floor.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {hasPermission(P.FLOORS.EDIT) && (
                      <button onClick={() => openEdit(floor)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                        <Pencil size={16} />
                      </button>
                    )}
                    {hasPermission(P.FLOORS.DEACTIVATE) && (
                      <button
                        onClick={() => handleToggleStatus(floor)}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${floor.status === "ACTIVE" ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                      >
                        {floor.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingFloor ? "Edit Floor" : "Add Floor"}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Floor Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="e.g. 1st Floor"
              autoFocus
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
              {editingFloor ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <BulkImportModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Import Floors"
        columns={[
          { key: "name", label: "Floor Name", required: true, example: "1st Floor" },
        ]}
        onImport={async (items) => {
          const res = await floorApi.bulkImport(propertyId, items);
          return res.data.data;
        }}
        onComplete={() => {
          fetchFloors();
          onUpdate();
        }}
      />
    </div>
  );
}
