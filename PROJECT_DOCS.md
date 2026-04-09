# TNMS — Tenant & Network Management System

## What Is This?

TNMS is an internal property management platform built for facilities teams to track assets, raise maintenance tickets, manage users, and monitor operational activity across multiple properties. Think of it as a lightweight CMMS (Computerized Maintenance Management System) with role-based access, ticket workflows, and a notification engine — purpose-built for a multi-property setup.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT tokens + bcrypt |
| HTTP Client | Axios |
| Maps | Leaflet |
| File Uploads | Multer |

---

## Project Structure

```
TNMS/
├── client/                  # React SPA
│   └── src/
│       ├── pages/           # 20 page components
│       ├── components/      # Reusable UI (Modal, Toast, Layout...)
│       ├── contexts/        # AuthContext, NotificationContext
│       └── lib/api.ts       # Axios instance + all API calls
│
├── server/                  # Express backend
│   ├── modules/             # 18 feature modules
│   │   ├── auth/
│   │   ├── ticket/
│   │   ├── asset/
│   │   ├── property/
│   │   ├── user/
│   │   ├── role/
│   │   ├── department/
│   │   ├── notification/
│   │   ├── report/
│   │   └── ...
│   ├── middleware/          # authenticate, authorize, upload, rateLimit
│   ├── services/            # RBAC, notifications, audit
│   └── config/              # DB connection, seeding
│
├── shared/
│   ├── permissions.ts       # All 50+ permission keys
│   └── types.ts             # Shared enums, labels, interfaces
│
├── prisma/
│   └── schema.prisma        # Full database schema
│
└── uploads/                 # Stored images
```

Each server module follows the same pattern: `controller.ts` (handles HTTP) → `service.ts` (business logic) → Prisma → PostgreSQL.

---

## Database Schema

### Enums

| Enum | Values |
|------|--------|
| `TicketStatus` | OPEN, IN_PROGRESS, OVERDUE, COMPLETED |
| `Priority` | CRITICAL, HIGH, MEDIUM, LOW |
| `TaskType` | COMPLAIN, MAINTENANCE, INSPECT, TASK |
| `SubTaskType` | REACTIVE, PREVENTIVE |
| `AssetCondition` | EXCELLENT, GOOD, FAIR, POOR |
| `PropertyType` | FLOOR, BUILDING, COMPOUND |
| `City` | LAHORE, ISLAMABAD |
| `Status` | ACTIVE, INACTIVE, BLOCKED |
| `TodoStatus` | OPEN, COMPLETED |
| `RecurringType` | DAILY, WEEKLY, MONTHLY |

---

### Core Models

#### User
The central actor in the system.

```
User
 ├── id, username, passwordHash, fullName, email, phone
 ├── isSuperAdmin          — bypasses all permission checks
 ├── allProperties         — access to every property without explicit assignment
 ├── roleId                — FK to Role (RBAC)
 ├── departmentId          — FK to Department
 └── status                — ACTIVE | INACTIVE | BLOCKED
```

#### Role & Permission
Classic RBAC. Roles hold a bundle of permissions.

```
Role
 ├── name                  — unique
 ├── isSystemRole          — can't be deleted
 └── permissions           — many-to-many via RolePermission

Permission
 ├── key                   — e.g. "tickets.view_all"
 └── module                — e.g. "tickets"
```

Authorization is **permissions-only**. The legacy `level` /
`canAssignToMaxLevel` hierarchy was removed in 2026-04; who can do what is
determined purely by the permission set attached to the user's role, with
super-admin bypassing all checks.

#### Property Hierarchy
Properties can contain Floors, which contain Units.

```
Property  →  Floor  →  Unit
    ↓
  Asset (located on a floor within a property)
```

```
Property
 ├── name, code, type (BUILDING | FLOOR | COMPOUND)
 ├── city, areaGroupId
 ├── latitude, longitude, imagePath
 └── status

Floor
 ├── name, propertyId
 └── status

Unit
 ├── code, name, unitType
 ├── floorId, propertyId
 └── status

AreaGroup
 ├── city (unique)
 └── groupName            — e.g. "Central Lahore"
```

#### Asset
Physical items tracked per property/floor.

```
Asset
 ├── code (unique), name
 ├── categoryId           — FK to AssetCategory
 ├── unitOfMeasure, quantity
 ├── condition            — EXCELLENT | GOOD | FAIR | POOR
 ├── floorId, propertyId
 ├── serialNumber, purchaseDate
 ├── imagePath, qrCode (unique)
 └── status
```

#### Ticket
The main workflow object in the system.

```
Ticket
 ├── ticketNumber          — auto-generated (e.g. TKT0001)
 ├── name, description
 ├── propertyId, unitId    — where the issue is
 ├── dueDate, completedAt
 ├── taskType, subTaskType, priority
 ├── categoryId, departmentId
 ├── status                — OPEN | IN_PROGRESS | OVERDUE | COMPLETED
 ├── createdById, assignedToId
 ├── isRecurring, recurringType, recurringDay, recurringDueDays
 └── imagePath
```

Supporting Ticket models:

```
TicketAsset     — junction: links assets to a ticket (many-to-many)
TicketComment   — comments on a ticket, linked to user
TicketActivity  — audit trail: every action recorded with actor + timestamp
TicketBlock     — block record (independent of status, see section below)
TicketCategory  — configurable categories (e.g. Electrical, Civil)
```

#### TicketBlock
A block is a separate concept from status. A ticket can be OVERDUE and blocked at the same time.

```
TicketBlock
 ├── ticketId
 ├── blockedById           — who raised the block
 ├── blockingUserId        — (optional) specific person blocking
 ├── departmentId          — which department is blocking
 ├── reason
 ├── previousStatus        — kept for history
 └── resolvedAt, resolvedById, resolvedNote   — set when resolved
```

#### Department
Organisational grouping for users and tickets.

```
Department
 ├── name (unique)
 └── status
```

#### Notification
Stored notifications with metadata for deep-linking.

```
Notification
 ├── userId, type
 ├── title, message, linkUrl
 ├── isRead, readAt
 └── metadata (JSON)      — e.g. { ticketNumber, propertyName }
```

#### AuditLog
Every meaningful action in the system is logged.

```
AuditLog
 ├── userId, action, module
 ├── entityId             — ID of the affected resource
 ├── details (text)
 └── ipAddress
```

#### Todo
Personal task list per user.

```
Todo
 ├── title, dueDate
 ├── status (OPEN | COMPLETED)
 ├── completedAt
 └── userId
```

---

## Authentication

### Flow

1. Client sends `POST /api/auth/login` with `{ username, password }`
2. Server compares password against bcrypt hash in DB
3. On success, generates a signed JWT containing:
   ```json
   {
     "id": "uuid",
     "username": "john",
     "isSuperAdmin": false,
     "roleId": "uuid",
     "roleName": "Supervisor",
     "permissions": ["tickets.view_all", "assets.edit", "..."],
     "allProperties": false,
     "tv": 3
   }
   ```
4. Client stores token in `localStorage`, attaches as `Authorization: Bearer <token>` on every request
5. On 401 response, the Axios interceptor auto-clears the token and redirects to `/login`

---

## Authorization

Two independent layers run on every protected request.

### Layer 1 — Permission Check (RBAC)

Middleware: `requirePermission(key)` or `requireAnyPermission(...keys)`

- Super admins (`isSuperAdmin: true`) skip all checks
- Otherwise, the permission key must exist in the user's JWT `permissions[]` array
- Permissions are grouped by module:

```
PROPERTIES:  view, create, edit, deactivate, export
FLOORS:      view, create, edit, deactivate
UNITS:       view, create, edit, deactivate, export, import
ASSETS:      view, create, edit, deactivate, export, import, qr_download
TICKETS:     view_all, view_assigned, create, edit, update_status,
             assign, assignee_eligible, comment, export, reopen
TODOS:       access
DASHBOARD:   view
SETTINGS:    area_groups_manage, asset_categories_manage,
             ticket_categories_manage, departments_manage
USERS:       view, create, edit, deactivate, import
ROLES:       view, manage
AUDIT:       view, export
REPORTS:     view
```

### Layer 2 — Property Scope

Users can only see data inside properties they can access:

1. **Super admin** — sees everything
2. **`allProperties: true`** — sees all properties
3. **Explicit assignment** — rows in `UserPropertyAssignment` table
4. **Inherited access** — if user reports to a manager, they inherit that manager's property assignments

This scoping is applied in `findAll` queries to filter results down to what the user is allowed to see.

---

## Ticket System (Core Workflow)

### Status Lifecycle

```
OPEN
  └─→ IN_PROGRESS
          └─→ OVERDUE   (automatic, via scheduled job)
          └─→ COMPLETED (manual)
```

OVERDUE is auto-promoted by a background job every hour:
```
UPDATE tickets SET status = 'OVERDUE'
WHERE status IN ('OPEN', 'IN_PROGRESS') AND dueDate < NOW()
```

### Block System

Blocking is a separate overlay — it does NOT change the ticket's status. A ticket can simultaneously be OVERDUE and have an active block.

**Raising a block:**
- Any user with `tickets.update_status` OR the assigned technician can raise a block
- Must specify a department (and optionally a specific person) who is causing the delay
- A `TicketBlock` record is created with `resolvedAt = null`

**Resolving a block:**
- The person who raised it OR the blocked person can resolve it
- Optional resolution note
- When a ticket is marked COMPLETED, all active blocks are auto-resolved

**Visibility:**
- If you have an active block on a ticket, you gain read access to that ticket even without the normal `tickets.view_all` permission

### Ticket Assignment Rules

Assignment is validated by the RBAC service:
1. Assigner must have `tickets.assign` permission
2. Assignee must be active and have `tickets.assignee_eligible` permission
3. Assignee must have access to the ticket's property
4. Super admins bypass all checks

Role hierarchy / "cannot assign upward" was removed in 2026-04; assignment
is governed entirely by the permission set.

### Ticket Filters

The ticket list supports filtering by: status, priority, task type, property, unit, department, assignee, created by, created date range, due date range, and active block status.

### Recurring Tickets

Tickets can be set as recurring with `isRecurring: true`, specifying type (DAILY/WEEKLY/MONTHLY), day, and how many days ahead the due date should be set on generation.

---

## Notification System

### What triggers a notification

| Event | Who gets notified |
|-------|------------------|
| Ticket assigned to you | You |
| You were reassigned away | You (previous assignee) |
| Status changed on your ticket | Creator + Assignee |
| Comment added | Creator + Assignee (not the commenter) |
| New ticket in your property | All users with `tickets.view_all` for that property |
| Ticket edited (by someone else) | Assignee |
| Ticket becomes overdue | Assignee, Creator, Assignee's manager |
| Ticket due in 24 hours | Assignee |
| Ticket blocked | The blocking user |
| Ticket unblocked | The person who raised the block |
| Asset condition changes to POOR | All `tickets.view_all` users for that property |
| Property deactivated | Assigned users + allProperties users |
| Your account updated | You |
| Your password reset | You |
| Your status changed | You + your manager |
| New person reports to you | You (new manager) + previous manager |

### How it works

1. Server writes a `Notification` row to the DB when an event fires (fire-and-forget, non-blocking)
2. Frontend polls `GET /api/notifications/unread-count` on an interval
3. Notifications page fetches full list with `GET /api/notifications`
4. Bell icon in header shows unread count, clicking opens a dropdown

---

## Report Builder

The report builder (`POST /api/reports/query`) accepts a JSON query structure:

```json
{
  "measure": "overdue | completed | completed_late | total | by_priority | by_department",
  "breakdown": "property | department | assignee | category | month",
  "filters": {
    "propertyId": "...",
    "departmentId": "...",
    "dateFrom": "...",
    "dateTo": "..."
  }
}
```

For `completed_late`, the response includes:
- `count` — how many tickets completed after due date
- `avgDaysLate` — average days late (total overdue time)
- `avgDaysBlocked` — average days spent in an active block (lets managers see if lateness was due to a blocker, not the technician)

---

## RBAC Service

The RBAC service (`server/services/rbac.service.ts`) handles:

| Method | What it does |
|--------|-------------|
| `getUserPermissions(userId)` | Returns all permission keys for a user |
| `getUserPropertyIds(userId)` | Returns accessible property IDs (or `"all"`) |
| `userHasPropertyAccess(userId, propertyId)` | Single property check |
| `canAssignTo(assignerId, assigneeId, propertyId)` | Permission + property-access validation |
| `getAssignableUsers(assignerId, propertyId)` | List of valid assignees for a ticket |

---

## Client Pages

| Page | Route | Key Permission |
|------|-------|---------------|
| Login | `/login` | — |
| Dashboard | `/` | `dashboard.view` |
| Properties List | `/properties` | `properties.view` |
| Property Detail | `/properties/:id` | `properties.view` |
| Property Form | `/properties/new` | `properties.create` |
| Asset List | `/assets` | `assets.view` |
| Asset Detail | `/assets/:code` | `assets.view` |
| Ticket List | `/tickets` | `tickets.view_all` or `view_assigned` |
| Ticket Detail | `/tickets/:id` | `tickets.view_all` or `view_assigned` |
| Ticket Form | `/tickets/new` | `tickets.create` |
| Todos | `/todos` | `todos.access` |
| Users | `/settings/users` | `users.view` |
| Roles | `/settings/roles` | `roles.view` |
| Departments | `/settings/departments` | `settings.departments_manage` |
| Area Groups | `/settings/area-groups` | `settings.area_groups_manage` |
| Asset Categories | `/settings/asset-categories` | `settings.asset_categories_manage` |
| Ticket Categories | `/settings/ticket-categories` | `settings.ticket_categories_manage` |
| Audit Logs | `/settings/audit-logs` | `audit.view` |
| Reports | `/reports` | `reports.view` |
| Notifications | `/notifications` | — |

---

## API Structure

Base: `http://localhost:3000/api`

**Rate limits:**
- General endpoints: 1,000 req / 15 min per IP
- Login: 20 req / 15 min per IP
- Notification polling: 300 req / 15 min per IP

**Standard response shape:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}

{
  "success": false,
  "error": "What went wrong"
}
```

**Paginated responses:**
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 143,
      "totalPages": 8
    }
  }
}
```

---

## Scheduled Jobs

Running in `server/index.ts` every hour:

1. **`checkOverdueTickets()`** — promotes OPEN/IN_PROGRESS tickets past their due date to OVERDUE, then sends overdue notifications to assignee, creator, and assignee's manager
2. **`checkDueSoonTickets()`** — finds tickets due within 24 hours (still OPEN or IN_PROGRESS) and sends "due soon" notifications to the assignee

---

## Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/tnms
JWT_SECRET=<strong-random-secret>
PORT=3000
NODE_ENV=development | production
BCRYPT_SALT_ROUNDS=10
```

---

## File Uploads

- Uploaded to: `/uploads/<filename>`
- Served statically by Express at `/uploads/<filename>`
- Used for: property images, asset images, ticket images
- Handler: Multer (`middleware/upload.ts`)

---

## Default Admin Account

Seeded by `npm run db:seed`:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` |
| Role | Super Admin |
| Access | All permissions, all properties |

---

## Key Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Run backend + Vite frontend dev server |
| `npm run build` | Compile TypeScript + build frontend |
| `npm run db:push` | Apply schema changes directly (no migration file) |
| `npm run db:generate` | Regenerate Prisma client after schema change |
| `npm run db:seed` | Seed default roles, permissions, admin user |
| `npm run setup` | Full one-command setup |

---

## Security

1. **Passwords** — bcrypt hashed (10 rounds), never stored in plain text
2. **JWTs** — signed with `JWT_SECRET`, verified on every request
3. **Rate limiting** — protects login and API endpoints
4. **RBAC** — fine-grained permission checks on every route
5. **Property scoping** — prevents cross-property data leaks
6. **Parameterized queries** — Prisma prevents SQL injection
7. **Audit logging** — every significant action is logged with actor + IP
8. **Input validation** — controllers validate required fields before touching DB
