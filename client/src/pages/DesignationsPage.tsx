import { useState, useEffect } from "react";
import { designationApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState, TableLoading } from "../components/ui/DataTable";
import { ActiveBadge } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Plus, Pencil, BadgeCheck } from "lucide-react";

interface Designation {
  id: string;
  name: string;
  status: string;
  _count?: { users: number };
}

export default function DesignationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const fetchItems = () => {
    designationApi
      .list()
      .then((res) => setItems(res.data.data))
      .catch(() => toast.error("Failed to load designations"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setModalOpen(true);
  };

  const openEdit = (item: Designation) => {
    setEditingId(item.id);
    setName(item.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (editingId) {
        await designationApi.update(editingId, name.trim());
        toast.success("Designation updated");
      } else {
        await designationApi.create(name.trim());
        toast.success("Designation created");
      }
      setModalOpen(false);
      fetchItems();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save designation");
    }
  };

  const handleToggleStatus = async (item: Designation) => {
    try {
      if (item.status === "ACTIVE") {
        await designationApi.deactivate(item.id);
        toast.success("Designation deactivated");
      } else {
        await designationApi.activate(item.id);
        toast.success("Designation activated");
      }
      fetchItems();
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <TableLoading />;

  return (
    <div>
      <PageHeader
        title="Designations"
        subtitle="Manage job titles assigned to users (e.g. Facility Engineer, Community Executive)."
        actions={
          <button onClick={openAdd} className={cls.btnPrimary}>
            <Plus size={14} />
            Add Designation
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        <table className={cls.table}>
          <thead>
            <tr className="border-b border-gray-100">
              <th className={cls.th}>Name</th>
              <th className={cls.th}>Users</th>
              <th className={cls.th}>Status</th>
              <th className={cls.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon={<BadgeCheck size={36} />}
                    title="No designations yet"
                    subtitle="Add your first designation to get started."
                  />
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className={cls.tr}>
                  <td className={`${cls.td} font-medium`}>{item.name}</td>
                  <td className={`${cls.td} text-gray-600`}>{item._count?.users ?? 0}</td>
                  <td className={cls.td}>
                    <ActiveBadge status={item.status} />
                  </td>
                  <td className={cls.td}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(item)} className={cls.btnIcon}>
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          item.status === "ACTIVE"
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Designation" : "Add Designation"}
      >
        <div className="space-y-3">
          <div>
            <label className={cls.label}>Designation Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls.input}
              placeholder="e.g. Facility Engineer, Admin Manager"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setModalOpen(false)} className={cls.btnSecondary}>
              Cancel
            </button>
            <button onClick={handleSave} className={cls.btnPrimary}>
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
