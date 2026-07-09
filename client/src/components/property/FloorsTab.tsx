import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { floorApi } from "../../lib/api";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import BulkImportModal from "../ui/BulkImportModal";
import { cls } from "../../lib/styles";
import { ActiveBadge } from "../ui/Badge";
import { TableLoading, EmptyState } from "../ui/DataTable";
import { Plus, Pencil, Layers, Download, Upload, Trash2, Search, X } from "lucide-react";
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
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const visibleFloors = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return floors.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q)) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      return true;
    });
  }, [floors, searchInput, statusFilter]);
  const hasActiveFilters = !!(searchInput || statusFilter);

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
    const visibleIds = visibleFloors.map((f) => f.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
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

  if (loading) return <TableLoading />;

  return (
    <div>
      {/* Filter bar */}
      {floors.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search floor name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`${cls.input} pl-8`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cls.select}>
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      )}
      {hasActiveFilters && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-gray-500">
            {visibleFloors.length} of {floors.length}
          </span>
          <button
            onClick={() => { setSearchInput(""); setStatusFilter(""); }}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
          >
            Clear <X size={10} />
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div>
          {selectedIds.size > 0 && hasPermission(P.FLOORS.DELETE) && (
            <button onClick={handleBulkDelete} disabled={deleting} className={cls.btnDanger}>
              <Trash2 size={14} />
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
              className={cls.btnSecondary}
            >
              <Download size={14} />
              Export
            </button>
          )}
          {hasPermission(P.FLOORS.IMPORT) && (
            <button onClick={() => setBulkOpen(true)} className={cls.btnSecondary}>
              <Upload size={14} />
              Import
            </button>
          )}
          {hasPermission(P.FLOORS.CREATE) && (
            <button onClick={openAdd} className={cls.btnPrimary}>
              <Plus size={14} />
              Add Floor
            </button>
          )}
        </div>
      </div>

      {floors.length === 0 ? (
        <EmptyState
          icon={<Layers size={40} />}
          title="No floors added yet"
          subtitle="Add your first floor to get started"
        />
      ) : (
        <table className={cls.table}>
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={visibleFloors.length > 0 && visibleFloors.every((f) => selectedIds.has(f.id))}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
              <th className={cls.th}>Floor Name</th>
              <th className={cls.th}>Status</th>
              <th className={cls.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleFloors.map((floor) => (
              <tr key={floor.id} className={`${cls.tr} ${selectedIds.has(floor.id) ? "bg-primary-50/40" : ""}`}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(floor.id)}
                    onChange={() => toggleSelect(floor.id)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className={`${cls.td} font-medium`}>
                  <Link
                    to={`/units?propertyId=${propertyId}&floorId=${floor.id}`}
                    className={cls.link}
                    title="See units on this floor"
                  >
                    {floor.name}
                  </Link>
                </td>
                <td className={cls.td}><ActiveBadge status={floor.status} /></td>
                <td className={cls.td}>
                  <div className="flex items-center gap-1">
                    {hasPermission(P.FLOORS.EDIT) && (
                      <button onClick={() => openEdit(floor)} className={cls.btnIcon}>
                        <Pencil size={15} />
                      </button>
                    )}
                    {hasPermission(P.FLOORS.DEACTIVATE) && (
                      <button
                        onClick={() => handleToggleStatus(floor)}
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${floor.status === "ACTIVE" ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
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
        <div className="space-y-3">
          <div>
            <label className={cls.label}>Floor Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className={cls.input}
              placeholder="e.g. 1st Floor"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className={cls.btnSecondary}>Cancel</button>
            <button onClick={handleSave} className={cls.btnPrimary}>
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
