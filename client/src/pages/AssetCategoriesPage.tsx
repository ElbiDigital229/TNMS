import { useState, useEffect } from "react";
import { assetCategoryApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState, TableLoading } from "../components/ui/DataTable";
import { ActiveBadge } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Plus, Pencil, Package } from "lucide-react";

interface Category {
  id: string;
  name: string;
  status: string;
}

export default function AssetCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");

  const fetchCategories = () => {
    assetCategoryApi
      .list()
      .then((res) => setCategories(res.data.data))
      .catch(() => toast.error("Failed to load categories"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setName("");
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      if (editing) {
        await assetCategoryApi.update(editing.id, name);
        toast.success("Category updated");
      } else {
        await assetCategoryApi.create(name);
        toast.success("Category created");
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to save category";
      toast.error(msg);
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    try {
      if (cat.status === "ACTIVE") {
        await assetCategoryApi.deactivate(cat.id);
        toast.success("Category deactivated");
      } else {
        await assetCategoryApi.activate(cat.id);
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
        title="Asset Categories"
        subtitle="Manage categories available when creating assets."
        actions={
          <button onClick={openAdd} className={cls.btnPrimary}>
            <Plus size={14} />
            Add Category
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        {categories.length === 0 ? (
          <EmptyState
            icon={<Package size={36} />}
            title="No categories yet"
            subtitle="Add your first category to get started."
          />
        ) : (
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-100">
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Category" : "Add Category"}
      >
        <div className="space-y-3">
          <div>
            <label className={cls.label}>
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls.input}
              placeholder="e.g. HVAC, Furniture, IT Equipment"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModalOpen(false)} className={cls.btnSecondary}>
              Cancel
            </button>
            <button onClick={handleSave} className={cls.btnPrimary}>
              {editing ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
