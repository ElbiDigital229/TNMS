# Settings

## Overview

Settings pages manage system-wide configuration data used throughout the platform.

## Area Groups

**Route:** `/settings/area-groups`
**Permission:** `SETTINGS.AREA_GROUPS_MANAGE`

Area groups organize properties by city (Lahore, Islamabad). Each area group has a name and city association. Properties can be assigned to an area group for regional organization.

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/area-groups | List all area groups |
| PUT | /api/area-groups | Upsert area group by city |

## Asset Categories

**Route:** `/settings/asset-categories`
**Permission:** `SETTINGS.ASSET_CATEGORIES_MANAGE`

Categories for classifying assets (e.g., HVAC, Plumbing, Electrical, Furniture).

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/asset-categories | List categories |
| POST | /api/asset-categories | Create category |
| PUT | /api/asset-categories/:id | Update category |
| PATCH | /api/asset-categories/:id/deactivate | Deactivate |
| PATCH | /api/asset-categories/:id/activate | Activate |

## Ticket Categories

**Route:** `/settings/ticket-categories`
**Permission:** `SETTINGS.TICKET_CATEGORIES_MANAGE`

Categories for classifying tickets (e.g., Plumbing Issue, Electrical, General Maintenance).

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/ticket-categories | List categories |
| POST | /api/ticket-categories | Create category |
| PUT | /api/ticket-categories/:id | Update category |
| PATCH | /api/ticket-categories/:id/deactivate | Deactivate |
| PATCH | /api/ticket-categories/:id/activate | Activate |

## Departments

**Route:** `/settings/departments`
**Permission:** `SETTINGS.DEPARTMENTS_MANAGE`

Organizational departments (e.g., Maintenance, Security, Housekeeping). Departments are assigned to tickets and users.

### API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/departments | List departments |
| POST | /api/departments | Create department |
| PUT | /api/departments/:id | Update department |
| PATCH | /api/departments/:id/deactivate | Deactivate |
| PATCH | /api/departments/:id/activate | Activate |
| GET | /api/departments/:id/users | List department members |
