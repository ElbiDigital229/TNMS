import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

/** Build a full URL for a server-stored asset path (e.g. "uploads/foo.jpg"). */
export const assetUrl = (path: string | null | undefined): string => {
  if (!path) return "";
  const clean = path.replace(/^\//, "");
  // Uploads are served from the host root (nginx `location /uploads/`),
  // not under `/api/`, so strip a trailing `/api` from the env base.
  const envBase = (import.meta.env.VITE_API_URL || "")
    .replace(/\/$/, "")
    .replace(/\/api$/, "");
  if (envBase) return `${envBase}/${clean}`;
  // Otherwise serve from the same origin as the current page — the backend
  // and frontend are co-located in production, so a relative path resolves
  // correctly regardless of which domain we're on.
  return `/${clean}`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on the login page
      // and the request was not the login request itself
      const isLoginRequest = error.config?.url?.includes("/auth/login");
      if (!isLoginRequest && window.location.pathname !== "/login") {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post("/auth/login", { username, password }),
  me: () => api.get("/auth/me"),
};

// Property API
export const propertyApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/properties", { params }),
  getById: (id: string) => api.get(`/properties/${id}`),
  create: (data: FormData) =>
    api.post("/properties", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: string, data: FormData) =>
    api.put(`/properties/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deactivate: (id: string) => api.patch(`/properties/${id}/deactivate`),
  activate: (id: string) => api.patch(`/properties/${id}/activate`),
  exportCsv: (params?: Record<string, string>) =>
    api.get("/properties/export", { params, responseType: "blob" }),
};

// Floor API
export const floorApi = {
  list: (propertyId: string) => api.get(`/properties/${propertyId}/floors`),
  create: (propertyId: string, name: string) =>
    api.post(`/properties/${propertyId}/floors`, { name }),
  update: (id: string, name: string) =>
    api.put(`/properties/floors/${id}`, { name }),
  deactivate: (id: string) => api.patch(`/properties/floors/${id}/deactivate`),
  activate: (id: string) => api.patch(`/properties/floors/${id}/activate`),
  bulkImport: (propertyId: string, items: Record<string, string>[]) =>
    api.post(`/properties/${propertyId}/floors/bulk-import`, { items }),
  bulkDelete: (ids: string[]) =>
    api.delete("/properties/floors/bulk-delete", { data: { ids } }),
};

// Unit API
export const unitApi = {
  listAll: (params?: Record<string, string | number>) =>
    api.get("/units", { params }),
  list: (propertyId: string) => api.get(`/properties/${propertyId}/units`),
  create: (propertyId: string, data: Record<string, string | undefined>) =>
    api.post(`/properties/${propertyId}/units`, data),
  update: (id: string, data: Record<string, string | undefined>) =>
    api.put(`/properties/units/${id}`, data),
  deactivate: (id: string) => api.patch(`/properties/units/${id}/deactivate`),
  activate: (id: string) => api.patch(`/properties/units/${id}/activate`),
  bulkImport: (propertyId: string, items: Record<string, string>[]) =>
    api.post(`/properties/${propertyId}/units/bulk-import`, { items }),
  bulkDelete: (ids: string[]) =>
    api.post(`/properties/units/bulk-delete`, { ids }),
};

// Asset API
export const assetApi = {
  listAll: (params?: Record<string, string | number>) =>
    api.get("/assets", { params }),
  listByProperty: (propertyId: string) =>
    api.get(`/properties/${propertyId}/assets`),
  getById: (id: string) => api.get(`/assets/${id}`),
  getByCode: (code: string) => api.get(`/assets/code/${code}`),
  create: (propertyId: string, data: FormData) =>
    api.post(`/properties/${propertyId}/assets`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: string, data: FormData) =>
    api.put(`/assets/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getTickets: (id: string) => api.get(`/assets/${id}/tickets`),
  deactivate: (id: string) => api.patch(`/assets/${id}/deactivate`),
  activate: (id: string) => api.patch(`/assets/${id}/activate`),
  bulkImport: (propertyId: string, items: Record<string, string>[]) =>
    api.post(`/properties/${propertyId}/assets/bulk-import`, { items }),
  bulkDelete: (propertyId: string, ids: string[]) =>
    api.post(`/properties/${propertyId}/assets/bulk-delete`, { ids }),
  bulkStatus: (ids: string[], action: string) =>
    api.post("/assets/bulk-status", { ids, action }),
};

// Area Group API
export const areaGroupApi = {
  list: () => api.get("/area-groups"),
  upsert: (city: string, groupName: string) =>
    api.put("/area-groups", { city, groupName }),
};

// Asset Category API
export const assetCategoryApi = {
  list: () => api.get("/asset-categories"),
  create: (name: string) => api.post("/asset-categories", { name }),
  update: (id: string, name: string) =>
    api.put(`/asset-categories/${id}`, { name }),
  deactivate: (id: string) => api.patch(`/asset-categories/${id}/deactivate`),
  activate: (id: string) => api.patch(`/asset-categories/${id}/activate`),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => api.get("/dashboard/stats"),
};

// Ticket API
export const ticketApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/tickets", { params }),
  getById: (id: string) => api.get(`/tickets/${id}`),
  create: (data: FormData) =>
    api.post("/tickets", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  update: (id: string, data: FormData) =>
    api.put(`/tickets/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteImage: (id: string, imagePath: string) =>
    api.delete(`/tickets/${id}/images`, { data: { imagePath } }),
  updateStatus: (id: string, status: string) =>
    api.patch(`/tickets/${id}/status`, { status }),
  addComment: (id: string, content: string) =>
    api.post(`/tickets/${id}/comments`, { content }),
  editComment: (ticketId: string, commentId: string, content: string) =>
    api.put(`/tickets/${ticketId}/comments/${commentId}`, { content }),
  deleteComment: (ticketId: string, commentId: string) =>
    api.delete(`/tickets/${ticketId}/comments/${commentId}`),
  assign: (id: string, assigneeId: string) =>
    api.patch(`/tickets/${id}/assign`, { assigneeId }),
  bulkAssign: (ticketIds: string[], assigneeId: string) =>
    api.post(`/tickets/bulk-assign`, { ticketIds, assigneeId }),
  getAssignableUsers: (id: string) =>
    api.get(`/tickets/${id}/assignable-users`),
  block: (id: string, data: { blockingUserId?: string; departmentId: string; reason: string }) =>
    api.post(`/tickets/${id}/block`, data),
  unblock: (id: string, resolvedNote?: string) =>
    api.post(`/tickets/${id}/unblock`, { resolvedNote }),
  getRelated: (id: string) => api.get(`/tickets/${id}/related`),
  bulkImport: (items: Record<string, string>[]) =>
    api.post("/tickets/bulk-import", { items }),
  softDelete: (id: string) => api.delete(`/tickets/${id}`),
  restore: (id: string) => api.post(`/tickets/${id}/restore`),
};

// Ticket Category API
export const ticketCategoryApi = {
  list: () => api.get("/ticket-categories"),
  create: (name: string) => api.post("/ticket-categories", { name }),
  update: (id: string, name: string) =>
    api.put(`/ticket-categories/${id}`, { name }),
  deactivate: (id: string) => api.patch(`/ticket-categories/${id}/deactivate`),
  activate: (id: string) => api.patch(`/ticket-categories/${id}/activate`),
};

export const departmentApi = {
  list: () => api.get("/departments"),
  create: (name: string, headUserId?: string | null) =>
    api.post("/departments", { name, headUserId }),
  update: (id: string, name: string, headUserId?: string | null) =>
    api.put(`/departments/${id}`, { name, headUserId }),
  deactivate: (id: string) => api.patch(`/departments/${id}/deactivate`),
  activate: (id: string) => api.patch(`/departments/${id}/activate`),
  getUsers: (id: string) => api.get(`/departments/${id}/users`),
};

export const designationApi = {
  list: () => api.get("/designations"),
  create: (name: string) => api.post("/designations", { name }),
  update: (id: string, name: string) =>
    api.put(`/designations/${id}`, { name }),
  deactivate: (id: string) => api.patch(`/designations/${id}/deactivate`),
  activate: (id: string) => api.patch(`/designations/${id}/activate`),
};

// Todo API
export const todoApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/todos", { params }),
  getStats: (params?: Record<string, string>) =>
    api.get("/todos/stats", { params }),
  create: (title: string, dueDate: string) =>
    api.post("/todos", { title, dueDate }),
  update: (id: string, data: { title?: string; dueDate?: string }) =>
    api.put(`/todos/${id}`, data),
  complete: (id: string) => api.patch(`/todos/${id}/complete`),
  reopen: (id: string) => api.patch(`/todos/${id}/reopen`),
  remove: (id: string) => api.delete(`/todos/${id}`),
  // Watchers
  getWatchers: () => api.get("/todos/watchers"),
  addWatcher: (watcherId: string) =>
    api.post("/todos/watchers", { watcherId }),
  removeWatcher: (watcherId: string) =>
    api.delete(`/todos/watchers/${watcherId}`),
  getWatching: () => api.get("/todos/watching"),
};

// User API
export const userApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/users", { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: Record<string, unknown>) => api.post("/users", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/users/${id}`, data),
  updateProperties: (id: string, propertyIds: string[]) =>
    api.put(`/users/${id}/properties`, { propertyIds }),
  resetPassword: (id: string, newPassword: string) =>
    api.patch(`/users/${id}/password`, { newPassword }),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
  block: (id: string) => api.patch(`/users/${id}/block`),
  activate: (id: string) => api.patch(`/users/${id}/activate`),
  bulkImport: (items: Record<string, string>[]) =>
    api.post("/users/bulk-import", { items }),
};

// Role API
export const roleApi = {
  list: (params?: Record<string, string>) => api.get("/roles", { params }),
  getById: (id: string) => api.get(`/roles/${id}`),
  create: (data: Record<string, unknown>) => api.post("/roles", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/roles/${id}`, data),
  deactivate: (id: string) => api.patch(`/roles/${id}/deactivate`),
  activate: (id: string) => api.patch(`/roles/${id}/activate`),
};

// Permission API
export const permissionApi = {
  list: () => api.get("/permissions"),
};

// Audit API
export const auditApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/audit-logs", { params }),
  exportLogs: (params?: Record<string, string | number>) =>
    api.get("/audit-logs/export", { params, responseType: "blob" }),
};

// Report API
export const reportApi = {
  getDashboard: () => api.get("/reports/dashboard"),
  runQuery: (query: Record<string, unknown>) =>
    api.post("/reports/query", query),
  getEntityReport: (entityType: string, entityId: string) =>
    api.get(`/reports/entity/${entityType}/${entityId}`),
};

// Ticket Schedule API
export const ticketScheduleApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/ticket-schedules", { params }),
  getById: (id: string) => api.get(`/ticket-schedules/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post("/ticket-schedules", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/ticket-schedules/${id}`, data),
  remove: (id: string) => api.delete(`/ticket-schedules/${id}`),
  toggle: (id: string) => api.patch(`/ticket-schedules/${id}/toggle`),
};

// Notification API
export const notificationApi = {
  list: (params?: Record<string, string | number>) =>
    api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch("/notifications/read-all"),
};

// ─── Acquisitions ────────────────────────────────────────────────────────

export const acquisitionAgentApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get("/acquisitions/agents", { params }),
  getById: (id: string) => api.get(`/acquisitions/agents/${id}`),
  getDeals: (id: string) => api.get(`/acquisitions/agents/${id}/deals`),
  create: (data: Record<string, unknown>) =>
    api.post("/acquisitions/agents", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/acquisitions/agents/${id}`, data),
  remove: (id: string) => api.delete(`/acquisitions/agents/${id}`),
  restore: (id: string) => api.patch(`/acquisitions/agents/${id}/restore`),
  bulkImport: (items: Record<string, unknown>[]) =>
    api.post("/acquisitions/agents/import", { items }),
  exportUrl: (params?: Record<string, string | number | boolean>) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return `${api.defaults.baseURL}/acquisitions/agents/export.csv${qs}`;
  },
};

export const acquisitionLandApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get("/acquisitions/land", { params }),
  getById: (id: string) => api.get(`/acquisitions/land/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post("/acquisitions/land", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/acquisitions/land/${id}`, data),
  remove: (id: string) => api.delete(`/acquisitions/land/${id}`),
  restore: (id: string) => api.patch(`/acquisitions/land/${id}/restore`),
  bulkImport: (items: Record<string, unknown>[]) =>
    api.post("/acquisitions/land/import", { items }),
  exportUrl: (params?: Record<string, string | number | boolean>) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return `${api.defaults.baseURL}/acquisitions/land/export.csv${qs}`;
  },
};

export const acquisitionBuildingApi = {
  list: (params?: Record<string, string | number | boolean>) =>
    api.get("/acquisitions/buildings", { params }),
  getById: (id: string) => api.get(`/acquisitions/buildings/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post("/acquisitions/buildings", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/acquisitions/buildings/${id}`, data),
  remove: (id: string) => api.delete(`/acquisitions/buildings/${id}`),
  restore: (id: string) => api.patch(`/acquisitions/buildings/${id}/restore`),
  bulkImport: (items: Record<string, unknown>[]) =>
    api.post("/acquisitions/buildings/import", { items }),
  exportUrl: (params?: Record<string, string | number | boolean>) => {
    const qs = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return `${api.defaults.baseURL}/acquisitions/buildings/export.csv${qs}`;
  },
};

export const ppmApi = {
  list: (params?: Record<string, string>) => api.get("/ppms", { params }),
  get: (id: string) => api.get(`/ppms/${id}`),
  create: (data: { name: string; description?: string | null; steps: { text: string }[] }) =>
    api.post("/ppms", data),
  update: (id: string, data: { name?: string; description?: string | null; steps?: { text: string }[] }) =>
    api.put(`/ppms/${id}`, data),
  deactivate: (id: string) => api.patch(`/ppms/${id}/deactivate`),
  activate: (id: string) => api.patch(`/ppms/${id}/activate`),
  updateTicketStep: (ticketId: string, stepId: string, data: { status: string; remarks?: string | null }) =>
    api.patch(`/tickets/${ticketId}/ppm-steps/${stepId}`, data),
};

export default api;
