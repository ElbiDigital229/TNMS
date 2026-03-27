import { useState, useEffect } from "react";
import { userApi, roleApi, propertyApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import BulkImportModal from "../components/ui/BulkImportModal";
import { Users, Plus, Edit2, Power, Search, Shield, KeyRound, Upload } from "lucide-react";

interface Role {
  id: string;
  name: string;
}

interface Property {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  roleId?: string;
  reportsTo: { id: string; username: string; fullName?: string } | null;
  reportsToId: string | null;
  allProperties: boolean;
  isSuperAdmin: boolean;
  properties?: Property[];
  _count?: { propertyAssignments: number; subordinates: number };
  status: string;
}

const emptyForm = {
  username: "",
  password: "",
  fullName: "",
  email: "",
  phone: "",
  roleId: "",
  reportsToId: "",
  allProperties: true,
  propertyIds: [] as string[],
};

export default function UserManagementPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
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
      .list()
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

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchProperties();
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.fullName?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);
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

  const openEdit = (user: User) => {
    setEditing(user);
    setForm({
      username: user.username,
      password: "",
      fullName: user.fullName || "",
      email: user.email || "",
      phone: user.phone || "",
      roleId: user.role?.id || user.roleId || "",
      reportsToId: user.reportsToId || user.reportsTo?.id || "",
      allProperties: user.allProperties ?? true,
      propertyIds: user.properties?.map((p) => p.id) || [],
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
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!editing && !form.password.trim()) {
      toast.error("Password is required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        roleId: form.roleId || undefined,
        reportsToId: form.reportsToId || null,
        allProperties: form.allProperties,
        propertyIds: form.allProperties ? [] : form.propertyIds,
      };

      if (editing) {
        await userApi.update(editing.id, payload);
        if (!form.allProperties) {
          await userApi.updateProperties(editing.id, form.propertyIds);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            User Management
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">
            Manage system users, roles, and property access.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
          >
            <Upload size={18} />
            Bulk Import
          </button>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
          >
            <Plus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, or email..."
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-4 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
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
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="BLOCKED">Blocked</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
        {filteredUsers.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={48} className="mx-auto text-gray-300" />
            <p className="mt-3 font-medium text-gray-500">No users found</p>
            <p className="mt-1 text-[13px] text-gray-400">
              {search || filterRole || filterStatus
                ? "Try adjusting your filters."
                : "Add your first user to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Full Name
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Username
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Role
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Properties
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Reports To
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
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100/80 transition-colors duration-150 hover:bg-gray-50/80"
                  >
                    <td className="px-5 py-3.5 font-medium">
                      {user.fullName || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {user.username}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {user.email || "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      {user.role ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                          <Shield size={12} />
                          {user.role.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {user.allProperties
                        ? "All"
                        : user._count?.propertyAssignments ?? user.properties?.length ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {user.reportsTo
                        ? `${user.reportsTo.fullName || user.reportsTo.username}`
                        : "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.status === "ACTIVE"
                            ? "bg-green-50 text-green-600"
                            : user.status === "BLOCKED"
                              ? "bg-amber-50 text-amber-600"
                              : "bg-red-50 text-red-600"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {!user.isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        {user.status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => handleBlock(user)}
                              className="rounded px-2 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                              title="Block access without deactivating"
                            >
                              Block
                            </button>
                            <button
                              onClick={() => handleDeactivate(user)}
                              className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                              title="Fully deactivate (requires no subordinates or open tickets)"
                            >
                              Deactivate
                            </button>
                          </>
                        )}
                        {(user.status === "INACTIVE" || user.status === "BLOCKED") && (
                          <button
                            onClick={() => handleActivate(user)}
                            className="rounded px-2 py-0.5 text-xs font-medium text-green-600 hover:bg-green-50"
                          >
                            <Power size={14} className="inline mr-1" />
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
        <div className="space-y-4">
          {/* Username */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => updateForm("username", e.target.value)}
              readOnly={!!editing}
              className={`w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 ${
                editing ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""
              }`}
              placeholder="Enter username"
            />
          </div>

          {/* Password (create only) / Reset Password (edit) */}
          {editing ? (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setResetPwUser(editing);
                  setNewPassword("");
                  setResetPwOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                <KeyRound size={16} />
                Reset Password
              </button>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                placeholder="Enter password"
              />
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => updateForm("fullName", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter full name"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Email
            </label>
            <input
              type="text"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter email address"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Phone
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => updateForm("phone", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter phone number"
            />
          </div>

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Role
            </label>
            <select
              value={form.roleId}
              onChange={(e) => updateForm("roleId", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select a role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reports To */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Reports To
            </label>
            <select
              value={form.reportsToId}
              onChange={(e) => updateForm("reportsToId", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">None</option>
              {users
                .filter((u) => !editing || u.id !== editing.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.username}
                    {u.role ? ` (${u.role.name})` : ""}
                  </option>
                ))}
            </select>
          </div>

          {/* All Properties Toggle */}
          <div>
            <label className="flex items-center gap-2 text-[13px] font-medium text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allProperties}
                onChange={(e) => updateForm("allProperties", e.target.checked)}
                disabled={managerPropertyIds !== null && managerPropertyIds !== "all"}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
              />
              Access to all properties
            </label>
            {managerPropertyIds !== null && managerPropertyIds !== "all" && (
              <p className="mt-1 text-xs text-amber-600">
                Manager has access to specific properties only — this user inherits that scope.
              </p>
            )}
          </div>

          {/* Property Multi-select */}
          {!form.allProperties && (
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Assigned Properties
              </label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 p-2 space-y-1">
                {(() => {
                  const availableProperties =
                    managerPropertyIds && managerPropertyIds !== "all"
                      ? properties.filter((p) => managerPropertyIds.includes(p.id))
                      : properties;
                  return availableProperties.length === 0 ? (
                    <p className="px-2 py-1 text-[13px] text-gray-400">
                      {managerPropertyIds && managerPropertyIds !== "all"
                        ? "Manager has no properties assigned"
                        : "No properties available"}
                    </p>
                  ) : (
                    availableProperties.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.propertyIds.includes(p.id)}
                          onChange={() => toggleProperty(p.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        {p.name}
                      </label>
                    ))
                  );
                })()}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={closeModal}
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
        <div className="space-y-4">
          <p className="text-[13px] text-gray-500">
            Set a new password for{" "}
            <span className="font-medium text-gray-700">
              {resetPwUser?.fullName || resetPwUser?.username}
            </span>
            .
          </p>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter new password"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setResetPwOpen(false);
                setResetPwUser(null);
                setNewPassword("");
              }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
            >
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
          { key: "username", label: "Username", required: true, example: "john_doe" },
          { key: "password", label: "Password", required: true, example: "password123" },
          { key: "fullName", label: "Full Name", required: false, example: "John Doe" },
          { key: "email", label: "Email", required: false, example: "john@example.com" },
          { key: "phone", label: "Phone", required: false, example: "+923001234567" },
          { key: "roleName", label: "Role Name", required: true, example: "Technician" },
          { key: "reportsToUsername", label: "Reports To", required: false, example: "admin" },
          { key: "allProperties", label: "All Properties", required: false, example: "yes" },
          { key: "propertyNames", label: "Property Names", required: false, example: "Gulberg Heights;Blue Area Tower" },
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
