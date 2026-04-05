# API Reference

## Base URL

All API endpoints are prefixed with `/api`.

## Authentication

All endpoints (except login and asset code lookup) require a JWT bearer token:
```
Authorization: Bearer <token>
```

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

### Error
```json
{
  "success": false,
  "error": "Error description"
}
```

### Paginated
```json
{
  "success": true,
  "data": {
    "data": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 123,
      "totalPages": 3
    }
  }
}
```

## Endpoints by Module

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/login | No | Login with username/password |
| GET | /auth/me | Yes | Get current user profile |

### Dashboard
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /dashboard/stats | DASHBOARD.VIEW | System statistics |

### Properties
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /properties | PROPERTIES.VIEW | List (filtered, paginated) |
| GET | /properties/:id | PROPERTIES.VIEW | Get detail |
| POST | /properties | PROPERTIES.CREATE | Create (multipart) |
| PUT | /properties/:id | PROPERTIES.EDIT | Update (multipart) |
| PATCH | /properties/:id/deactivate | PROPERTIES.DEACTIVATE | Deactivate |
| PATCH | /properties/:id/activate | PROPERTIES.DEACTIVATE | Reactivate |
| GET | /properties/export | PROPERTIES.EXPORT | Export CSV |

### Floors
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /properties/:pid/floors | FLOORS.VIEW | List floors |
| POST | /properties/:pid/floors | FLOORS.CREATE | Create |
| PUT | /properties/floors/:id | FLOORS.EDIT | Update |
| PATCH | /properties/floors/:id/deactivate | FLOORS.DEACTIVATE | Deactivate |
| PATCH | /properties/floors/:id/activate | FLOORS.DEACTIVATE | Activate |
| POST | /properties/:pid/floors/bulk-import | FLOORS.IMPORT | Bulk import |
| DELETE | /properties/floors/bulk-delete | FLOORS.DELETE | Bulk delete |

### Units
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /units | UNITS.VIEW | List all units |
| GET | /properties/:pid/units | UNITS.VIEW | List by property |
| POST | /properties/:pid/units | UNITS.CREATE | Create |
| PUT | /properties/units/:id | UNITS.EDIT | Update |
| PATCH | /properties/units/:id/deactivate | UNITS.DEACTIVATE | Deactivate |
| PATCH | /properties/units/:id/activate | UNITS.DEACTIVATE | Activate |
| POST | /properties/:pid/units/bulk-import | UNITS.IMPORT | Bulk import |
| POST | /properties/units/bulk-delete | UNITS.VIEW | Bulk delete |

### Assets
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /assets | ASSETS.VIEW | List all (filtered) |
| GET | /assets/:id | ASSETS.VIEW | Get by ID |
| GET | /assets/code/:code | None | Get by QR code |
| GET | /properties/:pid/assets | ASSETS.VIEW | List by property |
| POST | /properties/:pid/assets | ASSETS.CREATE | Create (multipart) |
| PUT | /assets/:id | ASSETS.EDIT | Update (multipart) |
| PATCH | /assets/:id/deactivate | ASSETS.DEACTIVATE | Deactivate |
| PATCH | /assets/:id/activate | ASSETS.DEACTIVATE | Activate |
| GET | /assets/:id/tickets | ASSETS.VIEW | Get linked tickets |
| POST | /properties/:pid/assets/bulk-import | ASSETS.IMPORT | Bulk import |
| POST | /properties/:pid/assets/bulk-delete | ASSETS.VIEW | Bulk delete |
| POST | /assets/bulk-status | ASSETS.EDIT | Bulk activate/deactivate |

### Tickets
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /tickets | VIEW_ALL or VIEW_ASSIGNED | List (filtered) |
| GET | /tickets/:id | VIEW_ALL or VIEW_ASSIGNED | Get detail |
| POST | /tickets | TICKETS.CREATE | Create (multipart, up to 5 images) |
| PUT | /tickets/:id | TICKETS.EDIT | Update (multipart) |
| DELETE | /tickets/:id/images | TICKETS.EDIT | Delete image |
| PATCH | /tickets/:id/status | TICKETS.UPDATE_STATUS | Change status |
| POST | /tickets/:id/comments | TICKETS.COMMENT | Add comment |
| PUT | /tickets/:id/comments/:cid | TICKETS.COMMENT | Edit comment |
| DELETE | /tickets/:id/comments/:cid | TICKETS.COMMENT | Delete comment |
| PATCH | /tickets/:id/assign | TICKETS.ASSIGN | Assign user |
| GET | /tickets/:id/assignable-users | TICKETS.ASSIGN | Eligible users |
| GET | /tickets/:id/related | VIEW_ALL or VIEW_ASSIGNED | Related tickets |
| POST | /tickets/:id/block | UPDATE_STATUS or assignee | Block ticket |
| POST | /tickets/:id/unblock | UPDATE_STATUS or involved | Unblock ticket |

### Ticket Categories
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /ticket-categories | Auth | List |
| POST | /ticket-categories | TICKET_CATEGORIES_MANAGE | Create |
| PUT | /ticket-categories/:id | TICKET_CATEGORIES_MANAGE | Update |
| PATCH | /ticket-categories/:id/deactivate | TICKET_CATEGORIES_MANAGE | Deactivate |
| PATCH | /ticket-categories/:id/activate | TICKET_CATEGORIES_MANAGE | Activate |

### Asset Categories
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /asset-categories | Auth | List |
| POST | /asset-categories | ASSET_CATEGORIES_MANAGE | Create |
| PUT | /asset-categories/:id | ASSET_CATEGORIES_MANAGE | Update |
| PATCH | /asset-categories/:id/deactivate | ASSET_CATEGORIES_MANAGE | Deactivate |
| PATCH | /asset-categories/:id/activate | ASSET_CATEGORIES_MANAGE | Activate |

### Departments
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /departments | Auth | List |
| POST | /departments | DEPARTMENTS_MANAGE | Create |
| PUT | /departments/:id | DEPARTMENTS_MANAGE | Update |
| PATCH | /departments/:id/deactivate | DEPARTMENTS_MANAGE | Deactivate |
| PATCH | /departments/:id/activate | DEPARTMENTS_MANAGE | Activate |
| GET | /departments/:id/users | Auth | Members |

### Area Groups
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /area-groups | Auth | List |
| PUT | /area-groups | AREA_GROUPS_MANAGE | Upsert |

### Users
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /users | USERS.VIEW | List (filtered) |
| GET | /users/:id | USERS.VIEW | Get detail |
| POST | /users | USERS.CREATE | Create |
| PUT | /users/:id | USERS.EDIT | Update |
| PUT | /users/:id/properties | USERS.EDIT | Assign properties |
| PATCH | /users/:id/password | USERS.EDIT | Reset password |
| PATCH | /users/:id/deactivate | USERS.DEACTIVATE | Deactivate |
| PATCH | /users/:id/block | USERS.DEACTIVATE | Block |
| PATCH | /users/:id/activate | USERS.DEACTIVATE | Activate |
| GET | /users/:id/subordinates | USERS.VIEW | Direct reports |
| GET | /users/:id/properties | USERS.VIEW | Assigned properties |
| POST | /users/bulk-import | USERS.IMPORT | Bulk import |

### Roles
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /roles | ROLES.VIEW | List |
| GET | /roles/:id | ROLES.VIEW | Get with permissions |
| POST | /roles | ROLES.MANAGE | Create |
| PUT | /roles/:id | ROLES.MANAGE | Update with permissions |
| PATCH | /roles/:id/deactivate | ROLES.MANAGE | Deactivate |
| PATCH | /roles/:id/activate | ROLES.MANAGE | Activate |

### Permissions
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /permissions | Auth | List all permissions |

### Todos
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /todos | TODOS.ACCESS | List user's todos |
| GET | /todos/stats | TODOS.ACCESS | Todo counts |
| POST | /todos | TODOS.ACCESS | Create |
| PATCH | /todos/:id/complete | TODOS.ACCESS | Complete |
| PATCH | /todos/:id/reopen | TODOS.ACCESS | Reopen |
| DELETE | /todos/:id | TODOS.ACCESS | Delete |

### Notifications
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /notifications | Auth | List (paginated) |
| GET | /notifications/unread-count | Auth | Unread count |
| PATCH | /notifications/:id/read | Auth | Mark read |
| PATCH | /notifications/read-all | Auth | Mark all read |
| POST | /notifications/device-token | Auth | Register FCM token |
| DELETE | /notifications/device-token | Auth | Unregister token |
| POST | /notifications/run-scheduled-checks | Auth | Manual trigger |

### Audit Logs
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /audit-logs | AUDIT.VIEW | List (filtered) |
| GET | /audit-logs/export | AUDIT.EXPORT | Export CSV |

### Reports
| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | /reports/dashboard | REPORTS.VIEW | Dashboard KPIs |
| POST | /reports/query | REPORTS.VIEW | Custom query |
| GET | /reports/entity/user/:id | REPORTS.VIEW | User report |
| GET | /reports/entity/department/:id | REPORTS.VIEW | Department report |
| GET | /reports/entity/property/:id | REPORTS.VIEW | Property report |
| GET | /reports/entity/asset/:id | REPORTS.VIEW | Asset report |

## File Upload

Endpoints that accept file uploads use `multipart/form-data`:
- **Single image**: `image` field name
- **Multiple images**: `images` field name (max 5 files)
- **Accepted types**: JPEG, PNG, WebP, GIF
- **Max size**: 5MB per file
- Files saved to `/uploads/` directory, served statically
