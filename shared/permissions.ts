export const PERMISSIONS = {
  PROPERTIES: {
    VIEW: "properties.view",
    CREATE: "properties.create",
    EDIT: "properties.edit",
    DEACTIVATE: "properties.deactivate",
    EXPORT: "properties.export",
  },
  FLOORS: {
    VIEW: "floors.view",
    CREATE: "floors.create",
    EDIT: "floors.edit",
    DEACTIVATE: "floors.deactivate",
  },
  UNITS: {
    VIEW: "units.view",
    CREATE: "units.create",
    EDIT: "units.edit",
    DEACTIVATE: "units.deactivate",
    EXPORT: "units.export",
    IMPORT: "units.import",
  },
  ASSETS: {
    VIEW: "assets.view",
    CREATE: "assets.create",
    EDIT: "assets.edit",
    DEACTIVATE: "assets.deactivate",
    EXPORT: "assets.export",
    IMPORT: "assets.import",
    QR_DOWNLOAD: "assets.qr_download",
  },
  TICKETS: {
    VIEW_ALL: "tickets.view_all",
    VIEW_ASSIGNED: "tickets.view_assigned",
    CREATE: "tickets.create",
    EDIT: "tickets.edit",
    UPDATE_STATUS: "tickets.update_status",
    ASSIGN: "tickets.assign",
    ASSIGNEE_ELIGIBLE: "tickets.assignee_eligible",
    COMMENT: "tickets.comment",
    EXPORT: "tickets.export",
    REOPEN: "tickets.reopen",
  },
  TODOS: {
    ACCESS: "todos.access",
  },
  DASHBOARD: {
    VIEW: "dashboard.view",
  },
  SETTINGS: {
    AREA_GROUPS_MANAGE: "settings.area_groups.manage",
    ASSET_CATEGORIES_MANAGE: "settings.asset_categories.manage",
    TICKET_CATEGORIES_MANAGE: "settings.ticket_categories.manage",
  },
  USERS: {
    VIEW: "users.view",
    CREATE: "users.create",
    EDIT: "users.edit",
    DEACTIVATE: "users.deactivate",
    IMPORT: "users.import",
  },
  ROLES: {
    VIEW: "roles.view",
    MANAGE: "roles.manage",
  },
  AUDIT: {
    VIEW: "audit.view",
    EXPORT: "audit.export",
  },
  REPORTS: {
    VIEW: "reports.view",
  },
} as const;

// Flat list of all permission keys
export const ALL_PERMISSION_KEYS: string[] = Object.values(PERMISSIONS).flatMap(
  (module) => Object.values(module)
);

// Permission metadata for seeding and UI display
export const PERMISSION_DEFINITIONS: {
  key: string;
  module: string;
  description: string;
}[] = [
  // Properties
  { key: PERMISSIONS.PROPERTIES.VIEW, module: "properties", description: "View property list and details" },
  { key: PERMISSIONS.PROPERTIES.CREATE, module: "properties", description: "Create new properties" },
  { key: PERMISSIONS.PROPERTIES.EDIT, module: "properties", description: "Edit property details" },
  { key: PERMISSIONS.PROPERTIES.DEACTIVATE, module: "properties", description: "Deactivate/reactivate properties" },
  { key: PERMISSIONS.PROPERTIES.EXPORT, module: "properties", description: "Export property data" },
  // Floors
  { key: PERMISSIONS.FLOORS.VIEW, module: "floors", description: "View floors" },
  { key: PERMISSIONS.FLOORS.CREATE, module: "floors", description: "Add floors" },
  { key: PERMISSIONS.FLOORS.EDIT, module: "floors", description: "Edit floors" },
  { key: PERMISSIONS.FLOORS.DEACTIVATE, module: "floors", description: "Deactivate/reactivate floors" },
  // Units
  { key: PERMISSIONS.UNITS.VIEW, module: "units", description: "View units" },
  { key: PERMISSIONS.UNITS.CREATE, module: "units", description: "Add units" },
  { key: PERMISSIONS.UNITS.EDIT, module: "units", description: "Edit units" },
  { key: PERMISSIONS.UNITS.DEACTIVATE, module: "units", description: "Deactivate/reactivate units" },
  { key: PERMISSIONS.UNITS.EXPORT, module: "units", description: "Export unit data" },
  { key: PERMISSIONS.UNITS.IMPORT, module: "units", description: "Bulk import units" },
  // Assets
  { key: PERMISSIONS.ASSETS.VIEW, module: "assets", description: "View asset list and details" },
  { key: PERMISSIONS.ASSETS.CREATE, module: "assets", description: "Add assets" },
  { key: PERMISSIONS.ASSETS.EDIT, module: "assets", description: "Edit asset details" },
  { key: PERMISSIONS.ASSETS.DEACTIVATE, module: "assets", description: "Deactivate/reactivate assets" },
  { key: PERMISSIONS.ASSETS.EXPORT, module: "assets", description: "Export asset data" },
  { key: PERMISSIONS.ASSETS.IMPORT, module: "assets", description: "Bulk import assets" },
  { key: PERMISSIONS.ASSETS.QR_DOWNLOAD, module: "assets", description: "Download QR codes" },
  // Tickets
  { key: PERMISSIONS.TICKETS.VIEW_ALL, module: "tickets", description: "View all tickets for assigned properties" },
  { key: PERMISSIONS.TICKETS.VIEW_ASSIGNED, module: "tickets", description: "View only tickets assigned to you" },
  { key: PERMISSIONS.TICKETS.CREATE, module: "tickets", description: "Create new tickets" },
  { key: PERMISSIONS.TICKETS.EDIT, module: "tickets", description: "Edit ticket details" },
  { key: PERMISSIONS.TICKETS.UPDATE_STATUS, module: "tickets", description: "Change ticket status" },
  { key: PERMISSIONS.TICKETS.ASSIGN, module: "tickets", description: "Assign/reassign tickets" },
  { key: PERMISSIONS.TICKETS.ASSIGNEE_ELIGIBLE, module: "tickets", description: "Can be assigned tickets" },
  { key: PERMISSIONS.TICKETS.COMMENT, module: "tickets", description: "Add comments to tickets" },
  { key: PERMISSIONS.TICKETS.EXPORT, module: "tickets", description: "Export ticket data" },
  { key: PERMISSIONS.TICKETS.REOPEN, module: "tickets", description: "Reopen completed tickets" },
  // Todos
  { key: PERMISSIONS.TODOS.ACCESS, module: "todos", description: "Access to-do list feature" },
  // Dashboard
  { key: PERMISSIONS.DASHBOARD.VIEW, module: "dashboard", description: "View dashboard" },
  // Settings
  { key: PERMISSIONS.SETTINGS.AREA_GROUPS_MANAGE, module: "settings", description: "Manage area groups" },
  { key: PERMISSIONS.SETTINGS.ASSET_CATEGORIES_MANAGE, module: "settings", description: "Manage asset categories" },
  { key: PERMISSIONS.SETTINGS.TICKET_CATEGORIES_MANAGE, module: "settings", description: "Manage ticket categories" },
  // Users
  { key: PERMISSIONS.USERS.VIEW, module: "users", description: "View user list" },
  { key: PERMISSIONS.USERS.CREATE, module: "users", description: "Create new users" },
  { key: PERMISSIONS.USERS.EDIT, module: "users", description: "Edit user details" },
  { key: PERMISSIONS.USERS.DEACTIVATE, module: "users", description: "Deactivate/reactivate users" },
  { key: PERMISSIONS.USERS.IMPORT, module: "users", description: "Bulk import users" },
  // Roles
  { key: PERMISSIONS.ROLES.VIEW, module: "roles", description: "View roles" },
  { key: PERMISSIONS.ROLES.MANAGE, module: "roles", description: "Create/edit/delete roles" },
  // Audit
  { key: PERMISSIONS.AUDIT.VIEW, module: "audit", description: "View audit log" },
  { key: PERMISSIONS.AUDIT.EXPORT, module: "audit", description: "Export audit log" },
  // Reports
  { key: PERMISSIONS.REPORTS.VIEW, module: "reports", description: "Run report queries" },
];

// Module labels for UI grouping
export const MODULE_LABELS: Record<string, string> = {
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
  reports: "Reports",
};
