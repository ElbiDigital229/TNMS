import { useState, useEffect, useMemo } from "react";
import { unitApi, floorApi } from "../../lib/api";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import BulkImportModal from "../ui/BulkImportModal";
import { cls } from "../../lib/styles";
import { ActiveBadge } from "../ui/Badge";
import { TableLoading, EmptyState } from "../ui/DataTable";
import { Plus, Pencil, Building2, Upload, Trash2, Download, Search, X } from "lucide-react";
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

  // Filter controls
  const [searchInput, setSearchInput] = useState("");
  const [floorFilter, setFloorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
    const visibleIds = visibleUnits.map((u) => u.id);
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

  const visibleUnits = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return units.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.code.toLowerCase().includes(q)) return false;
      if (floorFilter && (u.floor?.id || "") !== floorFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      return true;
    });
  }, [units, searchInput, floorFilter, statusFilter]);
  const hasActiveFilters = !!(searchInput || floorFilter || statusFilter);

  if (loading) return <TableLoading />;

  return (
    <div>
      {/* Filter bar — stacks on mobile, one row on desktop */}
      {units.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or code..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`${cls.input} pl-8`}
            />
          </div>
          <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)} className={cls.select}>
            <option value="">All Floors</option>
            {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
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
            {visibleUnits.length} of {units.length}
          </span>
          <button
            onClick={() => { setSearchInput(""); setFloorFilter(""); setStatusFilter(""); }}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-200"
          >
            Clear <X size={10} />
          </button>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div>
          {selectedIds.size > 0 && hasPermission(P.UNITS.DEACTIVATE) && (
            <button onClick={handleBulkDelete} disabled={deleting} className={cls.btnDanger}>
              <Trash2 size={14} />
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
              className={cls.btnSecondary}
            >
              <Download size={14} />
              Export
            </button>
          )}
          {hasPermission(P.UNITS.IMPORT) && (
            <button onClick={() => setBulkOpen(true)} className={cls.btnSecondary}>
              <Upload size={14} />
              Bulk Import
            </button>
          )}
          {hasPermission(P.UNITS.CREATE) && (
            <button onClick={openAdd} className={cls.btnPrimary}>
              <Plus size={14} />
              Add Unit
            </button>
          )}
        </div>
      </div>

      {units.length === 0 ? (
        <EmptyState
          icon={<Building2 size={40} />}
          title="No units added yet"
          subtitle="Add your first unit to get started"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === units.length && units.length > 0}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className={cls.th}>Code</th>
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Floor</th>
                <th className={cls.th}>Type</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUnits.map((unit) => (
                <tr key={unit.id} className={`${cls.tr} ${selectedIds.has(unit.id) ? "bg-primary-50/40" : ""}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(unit.id)}
                      onChange={() => toggleSelect(unit.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className={`${cls.td} ${cls.mono}`}>{unit.code}</td>
                  <td className={`${cls.td} font-medium`}>{unit.name}</td>
                  <td className={cls.td}>
                    {(() => {
                      const floor = unit.floor;
                      if (!floor) return <span className="text-gray-600">{"\u2014"}</span>;
                      return (
                        <button
                          onClick={() => setFloorFilter(floor.id)}
                          className={cls.link}
                          title="Filter to this floor"
                        >
                          {floor.name}
                        </button>
                      );
                    })()}
                  </td>
                  <td className={`${cls.td} text-gray-600`}>{unit.unitType || "\u2014"}</td>
                  <td className={cls.td}><ActiveBadge status={unit.status} /></td>
                  <td className={cls.td}>
                    <div className="flex items-center gap-1">
                      {hasPermission(P.UNITS.EDIT) && (
                        <button onClick={() => openEdit(unit)} className={cls.btnIcon}>
                          <Pencil size={15} />
                        </button>
                      )}
                      {hasPermission(P.UNITS.DEACTIVATE) && (
                        <button
                          onClick={() => handleToggleStatus(unit)}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${unit.status === "ACTIVE" ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
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
        <div className="space-y-3">
          {editingUnit && (
            <div className="rounded-md bg-gray-50 px-3 py-2">
              <span className="text-[13px] text-gray-500">Unit Code: </span>
              <span className={cls.mono}>{editingUnit.code}</span>
            </div>
          )}

          <div>
            <label className={cls.label}>Unit Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={cls.input} placeholder="Enter unit name" />
          </div>

          <div>
            <label className={cls.label}>Select Floor</label>
            <select value={floorId} onChange={(e) => setFloorId(e.target.value)} className={`w-full ${cls.select}`}>
              <option value="">Select floor</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div>
            <label className={cls.label}>Unit Type</label>
            <input type="text" value={unitType} onChange={(e) => setUnitType(e.target.value)} className={cls.input} placeholder="e.g. Office, Retail, Storage" />
          </div>

          <div>
            <label className={cls.label}>Additional Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cls.textarea} placeholder="Optional description..." />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setModalOpen(false)} className={cls.btnSecondary}>Cancel</button>
            <button onClick={handleSave} className={cls.btnPrimary}>
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
          { key: "unitType", label: "Unit Type", required: false, example: "Office", aliases: ["Type"] },
          { key: "floorName", label: "Floor Name", required: false, example: "Ground Floor", aliases: ["Floor"] },
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
