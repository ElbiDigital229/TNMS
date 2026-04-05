# User Management

## Route

`/settings/users`

## Permissions

- `USERS.VIEW` - View user list
- `USERS.CREATE` - Create new users
- `USERS.EDIT` - Edit user details
- `USERS.DEACTIVATE` - Deactivate/block/activate users
- `USERS.IMPORT` - Bulk import users

## User Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| username | String | Unique login name |
| password | String | bcrypt hashed |
| fullName | String | Display name |
| email | String? | Email address |
| phone | String? | Phone number |
| roleId | UUID | Assigned role |
| departmentId | UUID? | Department membership |
| reportsTo | UUID? | Manager (user hierarchy) |
| allProperties | Boolean | Global property access flag |
| isSuperAdmin | Boolean | Bypasses all permission checks |
| status | Enum | ACTIVE, INACTIVE, BLOCKED |

## Features

### User List
- Search by name or username
- Filter by role, department, status
- Pagination
- Click to edit

### Create User
- Fields: username, password, full name, email, phone, role, department, reports-to
- Role selection limited by current user's role level
- Department assignment

### Edit User
- Update any user field
- Change role (respecting hierarchy)
- Change reporting manager
- Reset password

### Property Assignment
- Assign user to specific properties via `PUT /api/users/:id/properties`
- Or grant `allProperties` access for global scope
- Property access cascades through `reportsTo` chain

### Status Management
- **Activate** - Set user to ACTIVE
- **Deactivate** - Set user to INACTIVE (soft disable)
- **Block** - Set user to BLOCKED (security lockout)

### Bulk Import
- Upload spreadsheet to create multiple users at once
- Validates required fields and uniqueness

## User Hierarchy

The `reportsTo` field creates a manager/subordinate tree:

```
Super Admin
  -> Regional Manager
       -> Property Manager
            -> Technician
            -> Inspector
```

Hierarchy impacts:
- Property access inheritance (subordinates inherit manager's property access)
- Notification escalation (overdue tickets escalate to manager chain)
- Visibility (managers can see subordinates' assignments)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/users | List users (filtered, paginated) |
| GET | /api/users/:id | Get user details |
| POST | /api/users | Create user |
| PUT | /api/users/:id | Update user |
| PUT | /api/users/:id/properties | Assign properties |
| PATCH | /api/users/:id/password | Reset password |
| PATCH | /api/users/:id/deactivate | Deactivate |
| PATCH | /api/users/:id/block | Block |
| PATCH | /api/users/:id/activate | Activate |
| GET | /api/users/:id/subordinates | Get direct reports |
| GET | /api/users/:id/properties | Get assigned properties |
| POST | /api/users/bulk-import | Bulk import |

## Notifications

- `USER_ACCOUNT_CHANGED` - Sent to user when their account details change
- `USER_PASSWORD_RESET` - Sent to user on password reset
- `USER_STATUS_CHANGED` - Sent to user and their manager
- `USER_NEW_SUBORDINATE` - Sent to manager when a new user is assigned under them
- `USER_CREATED_UNDER_YOU` - Sent to manager when a new user reports to them
