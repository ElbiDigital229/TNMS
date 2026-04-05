# Dashboard

## Route

`/` (redirects based on permissions via SmartRedirect)

## Permission Required

`DASHBOARD.VIEW`

## Overview

The main dashboard provides a high-level snapshot of the system with real-time statistics and quick access to recent activity.

## Statistics Cards

The top section displays summary cards fetched from `GET /api/dashboard/stats`:

- **Total Properties** - Count of all properties in the system
- **Total Units** - Count of all units across properties
- **Total Assets** - Count of tracked assets
- **Total Tickets** - Count of all tickets
- **Tickets by Status** - Breakdown: Open, In Progress, Overdue, Completed
- **Tickets by Priority** - Breakdown: Critical, High, Medium, Low
- **Completion Rate** - Percentage of tickets completed vs. total

## Recent Tickets

A list of the most recent tickets with:
- Ticket number and name
- Status badge (color-coded)
- Priority badge
- Property name
- Assignee
- Created date

Clicking a ticket navigates to its detail page.

## API Endpoint

### `GET /api/dashboard/stats`

Returns aggregated counts and breakdowns. The service queries:
- Property, unit, asset counts
- Ticket counts grouped by status and priority
- Completion rate calculation
- Recent tickets list with relations (property, assignee, creator)
