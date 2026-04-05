# TNMS Platform Overview

## What is TNMS?

TNMS (True North Management System) is a property and facilities management platform for managing real estate properties, units, assets, and maintenance tickets. It provides a complete workflow from property setup through work-order tracking, with role-based access control, notifications, and analytics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Bundler | Vite |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (24h expiry) + bcrypt |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| File Uploads | Multer (local `uploads/` directory) |
| Mobile | Android WebView wrapper (APK) |
| Process Manager | PM2 (production) |
| Hosting | Ubuntu VPS |

## Architecture

```
client/               React SPA (Vite)
  src/
    pages/            Route-level page components
    components/       Reusable UI components
    lib/              API client, styles, utilities
    hooks/            Custom React hooks
server/               Express API
  modules/            Domain modules (auth, ticket, property, etc.)
    [module]/
      *.routes.ts     Express route definitions
      *.controller.ts Request handlers
      *.service.ts    Business logic & DB queries
  middleware/          Auth, authorization, upload, error handling
  services/           Cross-cutting services (RBAC, notifications)
shared/               Code shared between client and server
  permissions.ts      Permission constants
prisma/
  schema.prisma       Database schema
```

## Core Domain Model

The platform manages a hierarchy:

```
AreaGroup (city-level grouping)
  -> Property (building / compound / floor)
       -> Floor
            -> Unit (apartment / office / space)
                 -> Asset (equipment tracked within units)
                 -> Ticket (work orders linked to units)
```

## Key Features

- **Property Management** - CRUD for properties, floors, units with bulk import/export
- **Asset Tracking** - Equipment inventory with QR codes, condition monitoring, category management
- **Ticket System** - Full work-order lifecycle: create, assign, track status, block/unblock, comment, complete
- **SLA Monitoring** - Color-coded progress bars showing time remaining vs. due date
- **Recurring Tasks** - Tickets can be configured as daily/weekly/monthly recurring
- **Role-Based Access** - Granular permissions with role hierarchy and property-scoped access
- **User Hierarchy** - Manager/subordinate reporting chain with inherited property access
- **Notifications** - 19 event types with in-app display and FCM push to mobile
- **Audit Trail** - Every significant action logged with user, timestamp, IP, and details
- **Reports & Analytics** - Dashboard KPIs, custom report builder, entity-specific reports
- **Todo List** - Personal task management per user

## Design System

- **Primary Color**: Teal (#0ea899 family, 50-950 variants)
- **Sidebar**: Dark navy (#0D2637) with hover/active states
- **Font**: Inter
- **Component Library**: Centralized `cls` object in `lib/styles.ts` providing consistent class strings for cards, buttons, tables, forms, badges, etc.

## Authentication Flow

1. User submits username + password to `POST /api/auth/login`
2. Server validates with bcrypt, returns JWT token + user profile
3. Client stores token in localStorage
4. All API calls include `Authorization: Bearer <token>` header
5. Middleware validates token, hydrates `req.user` with permissions
6. 401 responses trigger redirect to login page

## Deployment

- **Server**: Ubuntu VPS at 18.234.126.30
- **Process Manager**: PM2 (`pm2 restart tnms`)
- **Deploy**: SSH with key `~/.ssh/tnms_deploy`, then `git pull && npx prisma db push && npx prisma generate && npm run build && pm2 restart tnms`
- **Mobile APK**: Android WebView wrapper in separate repo (`ElbiDigital229/TNMS-Mobile.git`)
