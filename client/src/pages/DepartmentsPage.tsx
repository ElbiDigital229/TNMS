import { useState, useEffect } from "react";
import { departmentApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { EmptyState, TableLoading } from "../components/ui/DataTable";
import { ActiveBadge } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Plus, Pencil, Building2 } from "lucide-react";

interface DeptUser {
  id: string;
  fullName: string | null;
  username: string;
}

interface Department {
  id: string;
  name: string;
  status: string;
  headUserId: string | null;
  head: DeptUser | null;
}

export default function DepartmentsPage() {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [headUserId, setHeadUserId] = useState<string>("");
  const [deptUsers, setDeptUsers] = useState<DeptUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchDepartments = () => {
    departmentApi
      .list()
      .then((res) => setDepartments(res.data.data))
      .catch(() => toast.error("Failed to load departments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setHeadUserId("");
    setDeptUsers([]);
    setModalOpen(true);
  };

  const openEdit = async (dept: Department) => {
    setEditingId(dept.id);
    setName(dept.name);
    setHeadUserId(dept.headUserId || "");
    setLoadingUsers(true);
    setModalOpen(true);
    try {
      const res = await departmentApi.getUsers(dept.id);
      setDeptUsers(res.data.data);
    } catch {
      setDeptUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (editingId) {
        await departmentApi.update(editingId, name.trim(), headUserId || null);
        toast.success("Department updated");
      } else {
        await departmentApi.create(name.trim(), headUserId || null);
        toast.success("Department created");
      }
      setModalOpen(false);
      fetchDepartments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save department");
    }
  };

  const handleToggleStatus = async (dept: Department) => {
    try {
      if (dept.status === "ACTIVE") {
        await departmentApi.deactivate(dept.id);
        toast.success("Department deactivated");
      } else {
        await departmentApi.activate(dept.id);
        toast.success("Department activated");
      }
      fetchDepartments();
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <TableLoading />;

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Manage departments, assign a head, and link them to users."
        actions={
          <button onClick={openAdd} className={cls.btnPrimary}>
            <Plus size={14} />
            Add Department
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        <table className={cls.table}>
          <thead>
            <tr className="border-b border-gray-100">
              <th className={cls.th}>Name</th>
              <th className={cls.th}>Head</th>
              <th className={cls.th}>Status</th>
              <th className={cls.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon={<Building2 size={36} />}
                    title="No departments yet"
                    subtitle="Add your first department to get started."
                  />
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept.id} className={cls.tr}>
                  <td className={`${cls.td} font-medium`}>{dept.name}</td>
                  <td className={`${cls.td} text-gray-600`}>
                    {dept.head ? dept.head.fullName || dept.head.username : <span className="text-gray-400">—</span>}
                  </td>
                  <td className={cls.td}>
                    <ActiveBadge status={dept.status} />
                  </td>
                  <td className={cls.td}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(dept)} className={cls.btnIcon}>
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(dept)}
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          dept.status === "ACTIVE"
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {dept.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
        title={editingId ? "Edit Department" : "Add Department"}
      >
        <div className="space-y-3">
          <div>
            <label className={cls.label}>Department Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls.input}
              placeholder="e.g. Operations, Maintenance"
              autoFocus
            />
          </div>

          {editingId && (
            <div>
              <label className={cls.label}>Department Head</label>
              {loadingUsers ? (
                <p className="text-[12px] text-gray-400">Loading users...</p>
              ) : deptUsers.length === 0 ? (
                <p className="text-[12px] text-gray-400">No active users in this department yet. Assign users first, then set a head.</p>
              ) : (
                <select
                  value={headUserId}
                  onChange={(e) => setHeadUserId(e.target.value)}
                  className={`${cls.select} w-full`}
                >
                  <option value="">No head assigned</option>
                  {deptUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.username}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-[11px] text-gray-500">
                Tickets created without an assignee will auto-assign to the department head.
              </p>
            </div>
          )}

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
