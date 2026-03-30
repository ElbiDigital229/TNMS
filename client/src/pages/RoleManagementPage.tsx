import { useState, useEffect, useMemo } from "react";
import { roleApi, permissionApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import Modal from "../components/ui/Modal";
import { Shield, Plus, Edit2, Power } from "lucide-react";

const MODULE_LABELS: Record<string, string> = {
  properties: "Properties",
  floors: "Floors",
  units: "Units",
  assets: "Assets",
  tickets: "Tickets",
  todos: "To-Do List",
  dashboard: "Dashboard",
  settings: "Settings",
  users: "User Management",
  roles: "Roles & Permissions",
  audit: "Audit Log",
};

interface Permission {
  id: string;
  key: string;
  module: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  level: number;
  canAssignToMaxLevel: number | null;
  isSystemRole: boolean;
  status: string;
  updatedAt?: string;
  _count?: { users: number; permissions: number };
  permissions?: { id: string; key: string }[];
}

export default function RoleManagementPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.ROLES.MANAGE);
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formLevel, setFormLevel] = useState<number>(0);
  const [formMaxLevel, setFormMaxLevel] = useState<string>("");
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<
    Set<string>
  >(new Set());

  const fetchRoles = () => {
    roleApi
      .list()
      .then((res) => setRoles(res.data.data))
      .catch(() => toast.error("Failed to load roles"))
      .finally(() => setLoading(false));
  };

  const fetchPermissions = () => {
    permissionApi
      .list()
      .then((res) => {
        const data = res.data.data;
        // API returns permissions grouped by module — flatten to array
        if (Array.isArray(data)) {
          setAllPermissions(data);
        } else {
          const flat: Permission[] = [];
          for (const perms of Object.values(data)) {
            flat.push(...(perms as Permission[]));
          }
          setAllPermissions(flat);
        }
      })
      .catch(() => toast.error("Failed to load permissions"));
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const permissionsByModule = useMemo(() => {
    const grouped: Record<string, Permission[]> = {};
    for (const perm of allPermissions) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }
    return grouped;
  }, [allPermissions]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormLevel(0);
    setFormMaxLevel("");
    setSelectedPermissionIds(new Set());
    setModalOpen(true);
  };

  const openEdit = async (role: Role) => {
    try {
      const res = await roleApi.getById(role.id);
      const fullRole: Role = res.data.data;
      setEditing(fullRole);
      setFormName(fullRole.name);
      setFormLevel(fullRole.level);
      setFormMaxLevel(
        fullRole.canAssignToMaxLevel != null
          ? String(fullRole.canAssignToMaxLevel)
          : ""
      );
      const permIds = new Set(
        (fullRole.permissions || []).map((p: any) => p.permission?.id || p.id)
      );
      setSelectedPermissionIds(permIds);
      setModalOpen(true);
    } catch {
      toast.error("Failed to load role details");
    }
  };

  const togglePermission = (id: string) => {
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModule = (module: string) => {
    const modulePerms = permissionsByModule[module] || [];
    const allSelected = modulePerms.every((p) =>
      selectedPermissionIds.has(p.id)
    );
    setSelectedPermissionIds((prev) => {
      const next = new Set(prev);
      for (const p of modulePerms) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  };

  const isModuleAllSelected = (module: string) => {
    const modulePerms = permissionsByModule[module] || [];
    return (
      modulePerms.length > 0 &&
      modulePerms.every((p) => selectedPermissionIds.has(p.id))
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Role name is required");
      return;
    }

    const payload: Record<string, unknown> = editing?.isSystemRole
      ? { permissionIds: Array.from(selectedPermissionIds) }
      : {
          name: formName.trim(),
          level: formLevel,
          canAssignToMaxLevel: formMaxLevel ? Number(formMaxLevel) : null,
          permissionIds: Array.from(selectedPermissionIds),
        };

    setSaving(true);
    try {
      if (editing) {
        if (editing.updatedAt) payload.expectedUpdatedAt = editing.updatedAt;
        await roleApi.update(editing.id, payload);
        toast.success("Role updated");
      } else {
        await roleApi.create(payload);
        toast.success("Role created");
      }
      setModalOpen(false);
      fetchRoles();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to save role";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (role: Role) => {
    try {
      if (role.status === "ACTIVE") {
        await roleApi.deactivate(role.id);
        toast.success("Role deactivated");
      } else {
        await roleApi.activate(role.id);
        toast.success("Role activated");
      }
      fetchRoles();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const getPermissionCount = (role: Role) => {
    return role._count?.permissions ?? role.permissions?.length ?? 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Roles &amp; Permissions
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">
            Define roles and assign granular permissions to control access across
            the platform.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
          >
            <Plus size={18} />
            Add Role
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
        {roles.length === 0 ? (
          <div className="py-12 text-center">
            <Shield size={48} className="mx-auto text-gray-300" />
            <p className="mt-3 font-medium text-gray-500">No roles yet</p>
            <p className="mt-1 text-[13px] text-gray-400">
              Add your first role to get started.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Role Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Level
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Users
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Permissions
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  System Role
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr
                  key={role.id}
                  className="border-b border-gray-100/80 transition-colors duration-150 hover:bg-gray-50/80"
                >
                  <td className="px-5 py-3.5 font-medium">{role.name}</td>
                  <td className="px-5 py-3.5">{role.level}</td>
                  <td className="px-5 py-3.5">{role._count?.users ?? 0}</td>
                  <td className="px-5 py-3.5">{getPermissionCount(role)}</td>
                  <td className="px-5 py-3.5">
                    {role.isSystemRole && (
                      <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600">
                        System
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        role.status === "ACTIVE"
                          ? "bg-green-50 text-green-600"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {role.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {canManage ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(role)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(role)}
                        disabled={role.isSystemRole && role.status === "ACTIVE"}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          role.isSystemRole && role.status === "ACTIVE"
                            ? "cursor-not-allowed text-gray-300"
                            : role.status === "ACTIVE"
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                        }`}
                        title={
                          role.isSystemRole && role.status === "ACTIVE"
                            ? "System roles cannot be deactivated"
                            : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          <Power size={14} />
                          {role.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </span>
                      </button>
                    </div>
                    ) : (
                      <span className="text-xs text-gray-400">View only</span>
                    )}
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
        title={editing ? "Edit Role" : "Add Role"}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={!!editing?.isSystemRole}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="e.g. Property Manager, Technician"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Level <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formLevel}
              onChange={(e) => setFormLevel(Number(e.target.value))}
              disabled={!!editing?.isSystemRole}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              min={0}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Max assignment depth
            </label>
            <input
              type="number"
              value={formMaxLevel}
              onChange={(e) => setFormMaxLevel(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Leave empty for no limit"
              min={0}
            />
          </div>

          <div>
            <label className="mb-2 block text-[13px] font-medium text-gray-700">
              Permissions
            </label>
            <div className="max-h-72 space-y-3 overflow-y-auto">
              {Object.entries(permissionsByModule).map(([module, perms]) => (
                <div key={module} className="rounded-lg bg-gray-50 p-4">
                  <label className="mb-2 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isModuleAllSelected(module)}
                      onChange={() => toggleModule(module)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-semibold text-gray-800">
                      {MODULE_LABELS[module] || module}
                    </span>
                    <span className="text-xs text-gray-400">Select All</span>
                  </label>

                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.has(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-[13px] text-gray-600">
                          {perm.description}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

