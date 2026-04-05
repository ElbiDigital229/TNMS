import { useState, useEffect } from "react";
import { ticketCategoryApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState, TableLoading } from "../components/ui/DataTable";
import { ActiveBadge } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Plus, Pencil, Tag } from "lucide-react";

interface Category {
  id: string;
  name: string;
  status: string;
}

export default function TicketCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const fetchCategories = () => {
    ticketCategoryApi
      .list()
      .then((res) => setCategories(res.data.data))
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setName(cat.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      if (editingId) {
        await ticketCategoryApi.update(editingId, name.trim());
        toast.success("Category updated");
      } else {
        await ticketCategoryApi.create(name.trim());
        toast.success("Category created");
      }
      setModalOpen(false);
      fetchCategories();
    } catch {
      toast.error("Failed to save category");
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    try {
      if (cat.status === "ACTIVE") {
        await ticketCategoryApi.deactivate(cat.id);
        toast.success("Category deactivated");
      } else {
        await ticketCategoryApi.activate(cat.id);
        toast.success("Category activated");
      }
      fetchCategories();
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <TableLoading />;

  return (
    <div>
      <PageHeader
        title="Ticket Categories"
        subtitle="Manage categories used for tickets."
        actions={
          <button onClick={openAdd} className={cls.btnPrimary}>
            <Plus size={14} />
            Add Category
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        <table className={cls.table}>
          <thead>
            <tr className="border-b border-gray-100">
              <th className={cls.th}>Name</th>
              <th className={cls.th}>Status</th>
              <th className={cls.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  <EmptyState
                    icon={<Tag size={36} />}
                    title="No categories yet"
                    subtitle="Add your first ticket category to get started."
                  />
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className={cls.tr}>
                  <td className={`${cls.td} font-medium`}>{cat.name}</td>
                  <td className={cls.td}>
                    <ActiveBadge status={cat.status} />
                  </td>
                  <td className={cls.td}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(cat)} className={cls.btnIcon}>
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(cat)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          cat.status === "ACTIVE"
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {cat.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
        title={editingId ? "Edit Category" : "Add Category"}
      >
        <div className="space-y-3">
          <div>
            <label className={cls.label}>Category Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls.input}
              placeholder="Enter category name"
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
