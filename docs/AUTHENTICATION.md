# Authentication & Authorization

## Authentication

### Login Flow

1. Client sends `POST /api/auth/login` with `{ username, password }`
2. Server looks up user by username (includes role and permissions)
3. Password verified with bcrypt
4. If valid, JWT signed with 24-hour expiry containing `{ id, username }`
5. Response includes token + full user object (id, name, role, permissions, properties)
6. Client stores token in `localStorage`

### Token Usage

- Every API request includes header: `Authorization: Bearer <token>`
- The `authenticate` middleware in `server/middleware/authenticate.ts` validates the token
- On valid token, `req.user` is hydrated with:
  - User ID, username, full name
  - Role name and level
  - `isSuperAdmin` flag
  - Array of permission keys
  - Property access scope (`allProperties` flag or specific property IDs)
- On invalid/expired token, returns 401 and client redirects to `/login`

### User Status Checks

The auth middleware also checks user status:
- `INACTIVE` users are rejected with 403
- `BLOCKED` users are rejected with 403
- Only `ACTIVE` users can authenticate

## Authorization

### Permission System

Permissions are granular strings organized by module. See `shared/permissions.ts`:

| Module | Permissions |
|--------|-----------|
| Properties | VIEW, CREATE, EDIT, DEACTIVATE, EXPORT |
| Floors | VIEW, CREATE, EDIT, DEACTIVATE, IMPORT, DELETE |
| Units | VIEW, CREATE, EDIT, DEACTIVATE, EXPORT, IMPORT |
| Assets | VIEW, CREATE, EDIT, DEACTIVATE, EXPORT, IMPORT, QR_DOWNLOAD |
| Tickets | VIEW_ALL, VIEW_ASSIGNED, CREATE, EDIT, UPDATE_STATUS, ASSIGN, ASSIGNEE_ELIGIBLE, COMMENT, EXPORT, REOPEN |
| Todos | ACCESS |
| Dashboard | VIEW |
| Settings | AREA_GROUPS_MANAGE, ASSET_CATEGORIES_MANAGE, TICKET_CATEGORIES_MANAGE, DEPARTMENTS_MANAGE |
| Users | VIEW, CREATE, EDIT, DEACTIVATE, IMPORT |
| Roles | VIEW, MANAGE |
| Audit | VIEW, EXPORT |
| Reports | VIEW |

### Role Hierarchy

- Each role has a numeric `level` (lower = more powerful)
- Roles also have a `maxAssignableLevel` controlling which roles they can assign to tickets
- `isSuperAdmin` flag bypasses all permission checks
- System roles (e.g., Super Admin) cannot be edited or deleted

### Authorization Middleware

Two middleware functions in `server/middleware/authorize.ts`:

- **`requirePermission(...keys)`** - User must have ALL listed permissions
- **`requireAnyPermission(...keys)`** - User must have at least ONE listed permission
- **`requirePropertyAccess()`** - Checks user has access to the requested property

### Property-Scoped Access

Users see only data for properties they're assigned to:

1. **Direct assignment**: `UserPropertyAssignment` table links user to properties
2. **All properties**: `allProperties` flag on user grants global access
3. **Inherited access**: Access inherited through `reportsTo` manager chain
4. Super admins always have full property access

### Ticket Visibility Rules

- `VIEW_ALL` permission: sees all tickets in assigned properties
- `VIEW_ASSIGNED` permission: sees only tickets assigned to them or created by them
- Active blockers can view tickets they're blocking (regardless of other permissions)
