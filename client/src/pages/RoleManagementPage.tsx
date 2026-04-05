import { useState, useEffect, useMemo } from "react";
import { roleApi, permissionApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import Modal from "../components/ui/Modal";
import PageHeader from "../components/ui/PageHeader";
import { TableLoading, EmptyState } from "../components/ui/DataTable";
import { ActiveBadge, Badge } from "../components/ui/Badge";
import { cls } from "../lib/styles";
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

  if (loading) return <TableLoading />;

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define roles and assign granular permissions to control access across the platform."
        actions={
          canManage ? (
            <button onClick={openAdd} className={cls.btnPrimary}>
              <Plus size={15} />
              Add Role
            </button>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        {roles.length === 0 ? (
          <EmptyState
            icon={<Shield size={40} />}
            title="No roles yet"
            subtitle="Add your first role to get started."
          />
        ) : (
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>Role Name</th>
                <th className={cls.th}>Level</th>
                <th className={cls.th}>Users</th>
                <th className={cls.th}>Permissions</th>
                <th className={cls.th}>System Role</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className={cls.tr}>
                  <td className={`${cls.td} font-medium`}>{role.name}</td>
                  <td className={cls.td}>{role.level}</td>
                  <td className={cls.td}>{role._count?.users ?? 0}</td>
                  <td className={cls.td}>{getPermissionCount(role)}</td>
                  <td className={cls.td}>
                    {role.isSystemRole && (
                      <Badge color="bg-purple-50 text-purple-600">System</Badge>
                    )}
                  </td>
                  <td className={cls.td}>
                    <ActiveBadge status={role.status} />
                  </td>
                  <td className={cls.td}>
                    {canManage ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(role)}
                        className={cls.btnIcon}
                        title="Edit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(role)}
                        disabled={role.isSystemRole && role.status === "ACTIVE"}
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
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
                        <span className="inline-flex items-center gap-0.5">
                          <Power size={12} />
                          {role.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </span>
                      </button>
                    </div>
                    ) : (
                      <span className="text-[11px] text-gray-400">View only</span>
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
        <div className="space-y-3">
          <div>
            <label className={cls.label}>
              Role Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={!!editing?.isSystemRole}
              className={`${cls.input} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
              placeholder="e.g. Property Manager, Technician"
              autoFocus
            />
          </div>

          <div>
            <label className={cls.label}>
              Level <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formLevel}
              onChange={(e) => setFormLevel(Number(e.target.value))}
              disabled={!!editing?.isSystemRole}
              className={`${cls.input} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500`}
              min={0}
            />
          </div>

          <div>
            <label className={cls.label}>Max assignment depth</label>
            <input
              type="number"
              value={formMaxLevel}
              onChange={(e) => setFormMaxLevel(e.target.value)}
              className={cls.input}
              placeholder="Leave empty for no limit"
              min={0}
            />
          </div>

          <div>
            <label className={cls.label}>Permissions</label>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {Object.entries(permissionsByModule).map(([module, perms]) => (
                <div key={module} className="rounded-md bg-gray-50 p-3">
                  <label className="mb-1.5 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isModuleAllSelected(module)}
                      onChange={() => toggleModule(module)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-[13px] font-semibold text-gray-800">
                      {MODULE_LABELS[module] || module}
                    </span>
                    <span className="text-[11px] text-gray-400">Select All</span>
                  </label>

                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {perms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-0.5 hover:bg-gray-100"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissionIds.has(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-[12px] text-gray-600">
                          {perm.description}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setModalOpen(false)}
              className={cls.btnSecondary}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cls.btnPrimary}
            >
              {saving ? "Saving..." : editing ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
