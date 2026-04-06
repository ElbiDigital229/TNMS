import { useState, useEffect } from "react";
import { userApi, roleApi, propertyApi, areaGroupApi, departmentApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import Modal from "../components/ui/Modal";
import BulkImportModal from "../components/ui/BulkImportModal";
import PageHeader from "../components/ui/PageHeader";
import { TableLoading, EmptyState } from "../components/ui/DataTable";
import { ActiveBadge, Badge } from "../components/ui/Badge";
import { cls } from "../lib/styles";
import { Users, Plus, Edit2, Power, Search, Shield, KeyRound, Upload } from "lucide-react";

interface Role {
  id: string;
  name: string;
  level: number;
}

interface Department {
  id: string;
  name: string;
  status: string;
}

interface AreaGroup {
  id: string;
  city: string;
  groupName: string;
}

interface Property {
  id: string;
  name: string;
  areaGroupId?: string;
  areaGroup?: AreaGroup;
}

interface User {
  id: string;
  username: string;
  fullName: string;
  employeeCode: string;
  email: string;
  phone: string;
  role: Role;
  roleId?: string;
  reportsTo: { id: string; username: string; fullName?: string } | null;
  reportsToId: string | null;
  allProperties: boolean;
  isSuperAdmin: boolean;
  properties?: Property[];
  department?: { id: string; name: string } | null;
  departmentId?: string | null;
  _count?: { propertyAssignments: number; subordinates: number };
  status: string;
}

type AccessMode = "all" | "specific" | string; // string for area group IDs

const emptyForm = {
  username: "",
  password: "",
  fullName: "",
  employeeCode: "",
  email: "",
  phone: "",
  roleId: "",
  reportsToId: "",
  departmentId: "",
  allProperties: true,
  propertyIds: [] as string[],
  accessMode: "all" as AccessMode,
};

export default function UserManagementPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [managerPropertyIds, setManagerPropertyIds] = useState<string[] | "all" | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const fetchUsers = () => {
    userApi
      .list({ limit: 100 })
      .then((res) => setUsers(res.data.data.data))
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setLoading(false));
  };

  const fetchRoles = () => {
    roleApi
      .list({ activeOnly: "true" })
      .then((res) => setRoles(res.data.data))
      .catch(() => toast.error("Failed to load roles"));
  };

  const fetchProperties = () => {
    propertyApi
      .list()
      .then((res) => setProperties(res.data.data.data))
      .catch(() => toast.error("Failed to load properties"));
  };

  const fetchAreaGroups = () => {
    areaGroupApi
      .list()
      .then((res) => setAreaGroups(res.data.data))
      .catch(() => {});
  };

  const fetchDepartments = () => {
    departmentApi
      .list()
      .then((res) => setDepartments(res.data.data.filter((d: Department) => d.status === "ACTIVE")))
      .catch(() => {});
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchProperties();
    fetchAreaGroups();
    fetchDepartments();
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.employeeCode?.toLowerCase().includes(q);
    const matchesRole = !filterRole || u.role?.id === filterRole;
    const matchesStatus = !filterStatus || u.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setManagerPropertyIds(null);
    setModalOpen(true);
  };

  const deriveAccessMode = (user: User): AccessMode => {
    if (user.allProperties) return "all";
    const userPropIds = new Set(user.properties?.map((p) => p.id) || []);
    if (userPropIds.size === 0) return "specific";
    // Check if user's properties exactly match an area group
    for (const ag of areaGroups) {
      const groupPropIds = properties
        .filter((p) => p.areaGroupId === ag.id)
        .map((p) => p.id);
      if (
        groupPropIds.length > 0 &&
        groupPropIds.length === userPropIds.size &&
        groupPropIds.every((id) => userPropIds.has(id))
      ) {
        return ag.id;
      }
    }
    return "specific";
  };

  const openEdit = (user: User) => {
    setEditing(user);
    const mode = deriveAccessMode(user);
    setForm({
      username: user.username,
      password: "",
      fullName: user.fullName || "",
      employeeCode: user.employeeCode || "",
      email: user.email || user.username || "",
      phone: user.phone || "",
      roleId: user.role?.id || user.roleId || "",
      reportsToId: user.reportsToId || user.reportsTo?.id || "",
      departmentId: user.department?.id || "",
      allProperties: user.allProperties ?? true,
      propertyIds: user.properties?.map((p) => p.id) || [],
      accessMode: mode,
    });
    const managerId = user.reportsToId || user.reportsTo?.id;
    if (managerId) {
      fetchManagerProperties(managerId);
    } else {
      setManagerPropertyIds(null);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    if (!editing && !form.password.trim()) {
      toast.error("Password is required");
      return;
    }

    const selectedRole = roles.find((r) => r.id === form.roleId);
    const requiresManager = selectedRole && selectedRole.level >= 4;
    if (requiresManager && !form.reportsToId) {
      toast.error(`${selectedRole.name} must have a reporting manager`);
      return;
    }

    setSaving(true);
    try {
      // Derive allProperties and propertyIds from accessMode
      let derivedAllProperties = false;
      let derivedPropertyIds: string[] = [];

      if (form.accessMode === "all") {
        derivedAllProperties = true;
      } else if (form.accessMode === "specific") {
        derivedPropertyIds = form.propertyIds;
      } else {
        // Area group ID — select all properties in that group
        derivedPropertyIds = properties
          .filter((p) => p.areaGroupId === form.accessMode)
          .map((p) => p.id);
      }

      const payload: Record<string, unknown> = {
        username: form.username,
        fullName: form.fullName,
        employeeCode: form.employeeCode || null,
        email: form.email,
        phone: form.phone,
        roleId: form.roleId || undefined,
        reportsToId: form.reportsToId || null,
        departmentId: form.departmentId || null,
        allProperties: derivedAllProperties,
        propertyIds: derivedAllProperties ? [] : derivedPropertyIds,
      };

      if (editing) {
        await userApi.update(editing.id, payload);
        if (!derivedAllProperties) {
          await userApi.updateProperties(editing.id, derivedPropertyIds);
        }
        toast.success("User updated");
      } else {
        payload.password = form.password;
        await userApi.create(payload);
        toast.success("User created");
      }
      closeModal();
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to save user";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (user: User) => {
    try {
      await userApi.deactivate(user.id);
      toast.success("User deactivated");
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to deactivate user";
      toast.error(msg);
    }
  };

  const handleBlock = async (user: User) => {
    try {
      await userApi.block(user.id);
      toast.success("User access blocked");
      fetchUsers();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to block user";
      toast.error(msg);
    }
  };

  const handleActivate = async (user: User) => {
    try {
      await userApi.activate(user.id);
      toast.success("User activated");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to activate user");
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      toast.error("Password is required");
      return;
    }
    if (!resetPwUser) return;
    try {
      await userApi.resetPassword(resetPwUser.id, newPassword);
      toast.success("Password reset successfully");
      setResetPwOpen(false);
      setResetPwUser(null);
      setNewPassword("");
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to reset password";
      toast.error(msg);
    }
  };

  const fetchManagerProperties = async (managerId: string) => {
    if (!managerId) {
      setManagerPropertyIds(null);
      return;
    }
    try {
      const res = await userApi.getManagerProperties(managerId);
      setManagerPropertyIds(res.data.data);
    } catch {
      setManagerPropertyIds(null);
    }
  };

  const updateForm = (field: string, value: unknown) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // When reportsTo changes, reset property selections that exceed manager's access
      if (field === "reportsToId") {
        fetchManagerProperties(value as string);
      }
      return next;
    });
  };

  const toggleProperty = (propId: string) => {
    setForm((prev) => ({
      ...prev,
      propertyIds: prev.propertyIds.includes(propId)
        ? prev.propertyIds.filter((id) => id !== propId)
        : [...prev.propertyIds, propId],
    }));
  };

  if (loading) return <TableLoading />;

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage system users, roles, and property access."
        actions={
          <>
            {hasPermission(PERMISSIONS.USERS.IMPORT) && (
              <button onClick={() => setBulkOpen(true)} className={cls.btnSecondary}>
                <Upload size={15} />
                Bulk Import
              </button>
            )}
            {hasPermission(PERMISSIONS.USERS.CREATE) && (
              <button onClick={openAdd} className={cls.btnPrimary}>
                <Plus size={15} />
                Add User
              </button>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, or email..."
            className={`${cls.input} pl-8`}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className={cls.select}
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={cls.select}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="BLOCKED">Blocked</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users size={40} />}
            title="No users found"
            subtitle={
              search || filterRole || filterStatus
                ? "Try adjusting your filters."
                : "Add your first user to get started."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className={cls.table}>
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={cls.th}>Full Name</th>
                  <th className={cls.th}>Emp Code</th>
                  <th className={cls.th}>Email</th>
                  <th className={cls.th}>Role</th>
                  <th className={cls.th}>Properties</th>
                  <th className={cls.th}>Department</th>
                  <th className={cls.th}>Reports To</th>
                  <th className={cls.th}>Status</th>
                  <th className={cls.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={cls.tr}>
                    <td className={`${cls.td} font-medium`}>
                      {user.fullName || "-"}
                    </td>
                    <td className={`${cls.td} text-gray-500 font-mono text-[12px]`}>
                      {user.employeeCode || "-"}
                    </td>
                    <td className={`${cls.td} text-gray-600`}>
                      {user.email || user.username}
                    </td>
                    <td className={cls.td}>
                      {user.role ? (
                        <Badge color="bg-primary-50 text-primary-700">
                          <span className="inline-flex items-center gap-1">
                            <Shield size={10} />
                            {user.role.name}
                          </span>
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className={`${cls.td} text-gray-600`}>
                      {user.allProperties
                        ? "All"
                        : user._count?.propertyAssignments ?? user.properties?.length ?? 0}
                    </td>
                    <td className={`${cls.td} text-gray-600`}>
                      {user.department?.name || "-"}
                    </td>
                    <td className={`${cls.td} text-gray-600`}>
                      {user.reportsTo
                        ? `${user.reportsTo.fullName || user.reportsTo.username}`
                        : "-"}
                    </td>
                    <td className={cls.td}>
                      <Badge
                        color={
                          user.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700"
                            : user.status === "BLOCKED"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-red-50 text-red-600"
                        }
                      >
                        {user.status}
                      </Badge>
                    </td>
                    <td className={cls.td}>
                      {!user.isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        {hasPermission(PERMISSIONS.USERS.EDIT) && (
                          <button
                            onClick={() => openEdit(user)}
                            className={cls.btnIcon}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {hasPermission(PERMISSIONS.USERS.DEACTIVATE) && user.status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => handleBlock(user)}
                              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-50"
                              title="Block access without deactivating"
                            >
                              Block
                            </button>
                            <button
                              onClick={() => handleDeactivate(user)}
                              className="rounded px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:bg-red-50"
                              title="Fully deactivate (requires no subordinates or open tickets)"
                            >
                              Deactivate
                            </button>
                          </>
                        )}
                        {hasPermission(PERMISSIONS.USERS.DEACTIVATE) && (user.status === "INACTIVE" || user.status === "BLOCKED") && (
                          <button
                            onClick={() => handleActivate(user)}
                            className="rounded px-1.5 py-0.5 text-[11px] font-medium text-green-600 hover:bg-green-50"
                          >
                            <Power size={12} className="inline mr-0.5" />
                            Activate
                          </button>
                        )}
                      </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? "Edit User" : "Add User"}
      >
        <div className="space-y-3">
          {/* Full Name */}
          <div>
            <label className={cls.label}>Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => updateForm("fullName", e.target.value)}
              className={cls.input}
              placeholder="Enter full name"
            />
          </div>

          {/* Employee Code */}
          <div>
            <label className={cls.label}>Employee Code</label>
            <input
              type="text"
              value={form.employeeCode}
              onChange={(e) => updateForm("employeeCode", e.target.value)}
              className={cls.input}
              placeholder="e.g. EMP-001"
            />
          </div>

          {/* Email (used as username) */}
          <div>
            <label className={cls.label}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => {
                const val = e.target.value;
                setForm((prev) => ({ ...prev, email: val, username: val }));
              }}
              readOnly={!!editing}
              className={`${cls.input} ${editing ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
              placeholder="Enter email address"
            />
          </div>

          {/* Password (create only) / Reset Password (edit) */}
          {editing ? (
            <div>
              <label className={cls.label}>Password</label>
              <button
                type="button"
                onClick={() => {
                  setResetPwUser(editing);
                  setNewPassword("");
                  setResetPwOpen(true);
                }}
                className={cls.btnSecondary}
              >
                <KeyRound size={14} />
                Reset Password
              </button>
            </div>
          ) : (
            <div>
              <label className={cls.label}>
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                className={cls.input}
                placeholder="Enter password"
              />
            </div>
          )}

          {/* Phone */}
          <div>
            <label className={cls.label}>Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              className={cls.input}
              placeholder="Enter phone number"
            />
          </div>

          {/* Role */}
          <div>
            <label className={cls.label}>Role</label>
            <select
              value={form.roleId}
              onChange={(e) => {
                const newRoleId = e.target.value;
                const newRole = roles.find((r) => r.id === newRoleId);
                const needsManager = newRole && newRole.level >= 4;
                setForm((prev) => ({
                  ...prev,
                  roleId: newRoleId,
                  reportsToId: needsManager ? prev.reportsToId : "",
                }));
              }}
              className={`${cls.select} w-full`}
            >
              <option value="">Select a role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          {departments.length > 0 && (
          <div>
            <label className={cls.label}>Department</label>
            <select
              value={form.departmentId}
              onChange={(e) => updateForm("departmentId", e.target.value)}
              className={`${cls.select} w-full`}
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          )}

          {/* Reports To — shown for roles at level 4+ (Manager, Supervisor, Technician, etc.) */}
          {(() => {
            const sel = roles.find((r) => r.id === form.roleId);
            return sel && sel.level >= 4;
          })() && (
          <div>
            <label className={cls.label}>
              Reports To <span className="text-red-500">*</span>
            </label>
            <select
              value={form.reportsToId}
              onChange={(e) => updateForm("reportsToId", e.target.value)}
              className={`${cls.select} w-full`}
            >
              <option value="">Select manager</option>
              {users
                .filter((u) => {
                  if (editing && u.id === editing.id) return false;
                  const selectedRole = roles.find((r) => r.id === form.roleId);
                  if (!selectedRole) return false;
                  const userRole = roles.find((r) => r.name === u.role?.name);
                  if (!userRole) return false;
                  // Show users with a higher role (lower level number) in the same department
                  const userDeptId = u.departmentId || u.department?.id;
                  return userDeptId === form.departmentId && userRole.level < selectedRole.level;
                })
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.username} ({u.role?.name})
                  </option>
                ))}
            </select>
          </div>
          )}

          {/* Property Access — inherited if reporting to someone or role requires manager */}
          {(() => {
            const sel = roles.find((r) => r.id === form.roleId);
            const mustInherit = sel && sel.level >= 4;
            return mustInherit || form.reportsToId;
          })() ? (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5">
              <p className="text-[13px] text-blue-700 font-medium">Property access inherited from manager</p>
              <p className="text-[11px] text-blue-600 mt-0.5">This user will automatically have access to the same properties as their reporting manager.</p>
            </div>
          ) : (<>
          <div>
            <label className={cls.label}>Property Access</label>
            {managerPropertyIds !== null && managerPropertyIds !== "all" && (
              <p className="mb-1.5 text-[11px] text-amber-600">
                Manager has access to specific properties only — this user inherits that scope.
              </p>
            )}
            <div className="space-y-1.5 rounded-md border border-gray-300 p-2.5">
              {/* All properties */}
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input
                  type="radio"
                  name="accessMode"
                  checked={form.accessMode === "all"}
                  onChange={() => {
                    setForm((prev) => ({ ...prev, accessMode: "all", allProperties: true, propertyIds: [] }));
                  }}
                  disabled={managerPropertyIds !== null && managerPropertyIds !== "all"}
                  className="h-3.5 w-3.5 border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                />
                <span className="font-medium text-gray-700">Access to all properties</span>
              </label>

              {/* Area group options */}
              {areaGroups.map((ag) => {
                const groupProps = properties.filter((p) => p.areaGroupId === ag.id);
                if (groupProps.length === 0) return null;
                // If manager has limited access, only show groups where manager has at least one property
                if (managerPropertyIds && managerPropertyIds !== "all") {
                  const hasAccess = groupProps.some((p) => managerPropertyIds.includes(p.id));
                  if (!hasAccess) return null;
                }
                return (
                  <label key={ag.id} className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input
                      type="radio"
                      name="accessMode"
                      checked={form.accessMode === ag.id}
                      onChange={() => {
                        const ids = groupProps.map((p) => p.id);
                        setForm((prev) => ({ ...prev, accessMode: ag.id, allProperties: false, propertyIds: ids }));
                      }}
                      className="h-3.5 w-3.5 border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="font-medium text-gray-700">Access to {ag.groupName} only</span>
                    <span className="text-[11px] text-gray-400">({groupProps.map((p) => p.name).join(", ")})</span>
                  </label>
                );
              })}

              {/* Specific properties */}
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input
                  type="radio"
                  name="accessMode"
                  checked={form.accessMode === "specific"}
                  onChange={() => {
                    setForm((prev) => ({ ...prev, accessMode: "specific", allProperties: false }));
                  }}
                  className="h-3.5 w-3.5 border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-medium text-gray-700">Access to specific properties</span>
              </label>
            </div>
          </div>

          {/* Property Multi-select — only when "specific" is chosen */}
          {form.accessMode === "specific" && (
            <div>
              <label className={cls.label}>Select Properties</label>
              <div className="max-h-36 overflow-y-auto rounded-md border border-gray-300 p-2 space-y-0.5">
                {(() => {
                  const availableProperties =
                    managerPropertyIds && managerPropertyIds !== "all"
                      ? properties.filter((p) => managerPropertyIds.includes(p.id))
                      : properties;
                  return availableProperties.length === 0 ? (
                    <p className="px-2 py-1 text-[12px] text-gray-400">
                      {managerPropertyIds && managerPropertyIds !== "all"
                        ? "Manager has no properties assigned"
                        : "No properties available"}
                    </p>
                  ) : (
                    availableProperties.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.propertyIds.includes(p.id)}
                          onChange={() => toggleProperty(p.id)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span>{p.name}</span>
                        {p.areaGroup && (
                          <span className="text-[11px] text-gray-400">({p.areaGroup.groupName})</span>
                        )}
                      </label>
                    ))
                  );
                })()}
              </div>
            </div>
          )}
          </>)}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={closeModal} className={cls.btnSecondary}>
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

      {/* Reset Password Modal */}
      <Modal
        isOpen={resetPwOpen}
        onClose={() => {
          setResetPwOpen(false);
          setResetPwUser(null);
          setNewPassword("");
        }}
        title="Reset Password"
      >
        <div className="space-y-3">
          <p className="text-[12px] text-gray-500">
            Set a new password for{" "}
            <span className="font-medium text-gray-700">
              {resetPwUser?.fullName || resetPwUser?.username}
            </span>
            .
          </p>
          <div>
            <label className={cls.label}>
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={cls.input}
              placeholder="Enter new password"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setResetPwOpen(false);
                setResetPwUser(null);
                setNewPassword("");
              }}
              className={cls.btnSecondary}
            >
              Cancel
            </button>
            <button onClick={handleResetPassword} className={cls.btnPrimary}>
              Reset Password
            </button>
          </div>
        </div>
      </Modal>

      <BulkImportModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Import Users"
        columns={[
          { key: "fullName", label: "Full Name", required: true, example: "John Smith" },
          { key: "employeeCode", label: "Employee Code", required: false, example: "EMP-001" },
          { key: "username", label: "Username", required: true, example: "john.smith" },
          { key: "password", label: "Password", required: true, example: "Welcome@123" },
          { key: "email", label: "Email", required: false, example: "john@company.com" },
          { key: "phone", label: "Phone", required: false, example: "+923001234567" },
          { key: "role", label: "Role", required: true, example: "Technician" },
          { key: "department", label: "Department", required: false, example: "Civil" },
          { key: "reportsTo", label: "Reports To", required: false, example: "ahmed@company.com" },
          { key: "propertyAccess", label: "Property Access", required: false, example: "All" },
        ]}
        onImport={async (items) => {
          const res = await userApi.bulkImport(items);
          return res.data.data;
        }}
        onComplete={fetchUsers}
      />
    </div>
  );
}
