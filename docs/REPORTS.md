# Reports & Analytics

## Routes

- `/reports` - Reports hub (Dashboard tab + Entity Reports tab)
- `/reports/builder` - Custom report builder
- `/reports/:entityType/:entityId` - Entity-specific report detail

## Permission Required

`REPORTS.VIEW`

## Reports Dashboard

The default tab shows a KPI dashboard with:

### Stat Cards
- Total tickets
- Average resolution time
- SLA compliance rate
- Open tickets count

### Charts
- **Ticket Trend** - Line chart showing ticket creation over time
- **Priority Breakdown** - Donut chart of tickets by priority
- **Property Comparison** - Horizontal bar chart of tickets per property
- **Asset Health** - Donut chart of asset conditions
- **Technician Performance** - Table ranking users by tickets completed, avg resolution time

### API: `GET /api/reports/dashboard`

Returns all dashboard data in a single payload with ticket counts, SLA metrics, trend data, breakdowns, and performance rankings.

## Entity Reports Tab

Pre-built report types accessible from the reports page:
- **User Report** - Individual user's ticket performance
- **Department Report** - Department-level ticket metrics
- **Property Report** - Property-level ticket and asset stats
- **Asset Report** - Individual asset's ticket history

### Entity Report Page

Each entity report includes:
- Summary statistics (tickets assigned, completed, avg resolution, SLA compliance)
- **Donut charts** with click-to-filter (click a slice to filter the table below)
- **Bar charts** with click-to-filter (click a bar to filter)
- **Active filter chip** showing current drill-down with dismiss button
- **Data table** of related tickets, clickable rows navigate to ticket detail
- "Click to filter" hint labels on interactive charts

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/reports/entity/user/:userId | User report |
| GET | /api/reports/entity/department/:departmentId | Department report |
| GET | /api/reports/entity/property/:propertyId | Property report |
| GET | /api/reports/entity/asset/:assetId | Asset report |

## Report Builder

Full custom report builder at `/reports/builder`:

### Features
- Select report entity type (tickets, assets, properties, users)
- Configure columns to include
- Apply filters (date range, status, priority, property, etc.)
- Sort by any column
- Preview results in table
- Export to CSV

### API: `POST /api/reports/query`

Accepts a query configuration object and returns matching data.

## Chart Components

Custom SVG chart library in `client/src/components/charts/`:

- **DonutChart** - Circular chart with segments, supports click handlers
- **PieChart** - Standard pie chart
- **HBarChart** - Horizontal bar chart, supports click handlers
- **LineChart** - Time-series line chart
- **GroupedBarChart** - Multi-series bar chart with legend
