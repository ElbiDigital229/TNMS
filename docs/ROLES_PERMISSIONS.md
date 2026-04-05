# Roles & Permissions

## Route

`/settings/roles`

## Permissions Required

- `ROLES.VIEW` - View role list
- `ROLES.MANAGE` - Create/edit roles

## Role Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Role display name |
| level | Int | Hierarchy level (lower = more authority) |
| maxAssignableLevel | Int | Highest role level this role can assign tickets to |
| isSystemRole | Boolean | If true, cannot be edited/deleted |
| status | Enum | ACTIVE or INACTIVE |

## How Roles Work

### Hierarchy
- Roles have numeric levels: Level 1 (most powerful) to Level N (least)
- A user with level 3 can only manage users with level 4+ roles
- The `maxAssignableLevel` controls ticket assignment: a role with maxAssignableLevel 5 can assign tickets to any user with role level >= 5

### System Roles
- Pre-seeded roles marked as `isSystemRole: true`
- Cannot be deleted or have their level changed
- Example: "Super Admin" is a system role

### Permission Assignment
Each role is linked to specific permissions via the `RolePermission` junction table. When editing a role:
- All available permissions are shown grouped by module
- Toggle individual permissions on/off
- Changes take effect immediately for all users with that role

## Permission Categories

### Properties Module
| Permission | Description |
|-----------|-------------|
| VIEW | See property list and details |
| CREATE | Create new properties |
| EDIT | Modify property details |
| DEACTIVATE | Deactivate/reactivate properties |
| EXPORT | Export property data to CSV |

### Floors Module
| Permission | Description |
|-----------|-------------|
| VIEW | See floors within properties |
| CREATE | Add new floors |
| EDIT | Rename/modify floors |
| DEACTIVATE | Deactivate/reactivate floors |
| IMPORT | Bulk import floors |
| DELETE | Delete floors |

### Units Module
| Permission | Description |
|-----------|-------------|
| VIEW | See units within properties |
| CREATE | Add new units |
| EDIT | Modify unit details |
| DEACTIVATE | Deactivate/reactivate units |
| EXPORT | Export unit data |
| IMPORT | Bulk import units |

### Assets Module
| Permission | Description |
|-----------|-------------|
| VIEW | See asset list and details |
| CREATE | Add new assets |
| EDIT | Modify asset details |
| DEACTIVATE | Deactivate/reactivate assets |
| EXPORT | Export asset data |
| IMPORT | Bulk import assets |
| QR_DOWNLOAD | Download QR codes for assets |

### Tickets Module
| Permission | Description |
|-----------|-------------|
| VIEW_ALL | See all tickets in assigned properties |
| VIEW_ASSIGNED | See only own assigned/created tickets |
| CREATE | Create new tickets |
| EDIT | Modify ticket details |
| UPDATE_STATUS | Change ticket status |
| ASSIGN | Assign tickets to other users |
| ASSIGNEE_ELIGIBLE | Can be assigned tickets |
| COMMENT | Add comments to tickets |
| EXPORT | Export ticket data |
| REOPEN | Reopen completed tickets |

### Settings Module
| Permission | Description |
|-----------|-------------|
| AREA_GROUPS_MANAGE | Manage area groups |
| ASSET_CATEGORIES_MANAGE | Manage asset categories |
| TICKET_CATEGORIES_MANAGE | Manage ticket categories |
| DEPARTMENTS_MANAGE | Manage departments |

### Other Modules
| Permission | Description |
|-----------|-------------|
| DASHBOARD.VIEW | Access dashboard |
| TODOS.ACCESS | Use todo list |
| USERS.VIEW/CREATE/EDIT/DEACTIVATE/IMPORT | User management |
| ROLES.VIEW/MANAGE | Role management |
| AUDIT.VIEW/EXPORT | Audit log access |
| REPORTS.VIEW | Access reports |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/roles | List all roles |
| GET | /api/roles/:id | Get role with permissions |
| POST | /api/roles | Create role |
| PUT | /api/roles/:id | Update role and permissions |
| PATCH | /api/roles/:id/deactivate | Deactivate |
| PATCH | /api/roles/:id/activate | Activate |
| GET | /api/permissions | List all available permissions |
