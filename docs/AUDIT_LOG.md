# Audit Log

## Route

`/settings/audit-logs`

## Permissions

- `AUDIT.VIEW` - View audit logs
- `AUDIT.EXPORT` - Export audit logs to CSV

## Overview

Every significant action in the system is recorded in the audit log for compliance and traceability.

## AuditLog Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | User who performed the action |
| action | String | Action type (CREATE, UPDATE, DELETE, STATUS_CHANGE, etc.) |
| module | String | Module name (TICKET, PROPERTY, USER, ASSET, etc.) |
| entityId | String? | ID of the affected entity |
| details | String? | JSON string with change details |
| ipAddress | String? | Client IP address |
| createdAt | DateTime | Timestamp |

## Features

### Log List
- Filterable by:
  - Module (Ticket, Property, User, Asset, etc.)
  - Action type (Create, Update, Delete, etc.)
  - User (who performed the action)
  - Date range (from/to)
- Search by details text
- Pagination
- Each row shows: timestamp, user, action, module, entity, details summary

### Export
- Export filtered results as CSV
- Respects current filter selection

## What Gets Logged

- Property CRUD operations
- Floor/Unit CRUD operations
- Asset CRUD and condition changes
- Ticket creation, updates, status changes, assignments
- User CRUD, status changes, password resets
- Role creation and permission changes
- Comment additions
- Block/unblock actions
- Bulk operations (import, delete)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/audit-logs | List logs (filtered, paginated) |
| GET | /api/audit-logs/export | Export as CSV |
