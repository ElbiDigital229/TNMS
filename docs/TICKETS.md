# Tickets

## Routes

- `/tickets` - Ticket list
- `/tickets/new` - Create ticket
- `/tickets/:id` - Ticket detail
- `/tickets/:id/edit` - Edit ticket

## Permissions

- `TICKETS.VIEW_ALL` - View all tickets in assigned properties
- `TICKETS.VIEW_ASSIGNED` - View only tickets assigned to you or created by you
- `TICKETS.CREATE` - Create new tickets
- `TICKETS.EDIT` - Edit ticket details
- `TICKETS.UPDATE_STATUS` - Change ticket status
- `TICKETS.ASSIGN` - Assign tickets to users
- `TICKETS.ASSIGNEE_ELIGIBLE` - User can be assigned tickets
- `TICKETS.COMMENT` - Add comments to tickets
- `TICKETS.EXPORT` - Export ticket data
- `TICKETS.REOPEN` - Reopen completed tickets

## Ticket Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| ticketNumber | Int | Auto-increment display number |
| name | String | Ticket title |
| description | String | Detailed description |
| status | Enum | OPEN, IN_PROGRESS, OVERDUE, COMPLETED |
| priority | Enum | CRITICAL, HIGH, MEDIUM, LOW |
| taskType | Enum | COMPLAIN, MAINTENANCE, INSPECT, TASK |
| subTaskType | Enum | REACTIVE or PREVENTIVE |
| propertyId | UUID | Property this ticket belongs to |
| unitId | UUID | Unit this ticket is for |
| categoryId | UUID | Ticket category |
| departmentId | UUID | Responsible department |
| assignedToId | UUID? | Assigned technician/user |
| createdById | UUID | User who created the ticket |
| dueDate | DateTime | SLA due date |
| completedAt | DateTime? | When ticket was completed |
| imagePath | String? | JSON array of image paths (up to 5) |
| isRecurring | Boolean | Whether this is a recurring task |
| recurringType | Enum? | DAILY, WEEKLY, or MONTHLY |
| recurringDay | Int? | Day of week/month for recurrence |
| recurringDueDays | Int? | Days after creation until due |

## Ticket List Page

### Filters
- **Status**: Open, In Progress, Overdue, Completed
- **Priority**: Critical, High, Medium, Low
- **Task Type**: Complain, Maintenance, Inspect, Task
- **Property**: Dropdown of accessible properties
- **Assignee**: User selector
- **Created By**: User selector
- **Date Range**: Created from/to, Due from/to
- **Blocked**: Show only blocked tickets
- **Search**: Free-text search on ticket name/number

### Sorting
- Sortable by: created date, due date, priority, status, ticket number

### View Modes
- `VIEW_ALL`: Shows all tickets in user's property scope
- `VIEW_ASSIGNED`: Shows only tickets where user is assignee or creator

## Ticket Detail Page

### Status Timeline
Horizontal stepper showing ticket lifecycle:
- **Created** -> **Open** -> **In Progress** -> **Completed**
- Timestamps derived from `TicketActivity` records (STATUS_CHANGED actions)
- Completed steps show green checkmark, current step pulses, overdue shows red

### SLA Bar
Color-coded progress bar showing time elapsed vs. due date:
- **Green** (<=75% elapsed): On track
- **Amber** (75-90%): Getting close
- **Red** (>90% or overdue): Critical/overdue
- Pulsing red dot for overdue tickets
- Shows "X days remaining" or "X days overdue"
- Edge case: if due date <= created date, uses 1-day minimum window

### Image Gallery
- Thumbnail grid (desktop) or horizontal scroll strip (mobile)
- Click to open full-screen lightbox with prev/next navigation
- Upload new images (up to 5 total)
- Individual image deletion

### Comments
- Add comments with @mention support (type `@` to see user dropdown)
- Comments show: user avatar (initials), name, role badge, relative timestamp
- Edit/delete within 15-minute window (own comments only)
- Edited comments show "(edited)" indicator
- @mentions rendered as highlighted spans and trigger notifications

### Related Tickets
Sidebar showing up to 5 tickets that share the same unit or tagged assets. Clickable to navigate.

### Actions
- **Change Status**: Optimistic UI - updates immediately, reverts on API error
- **Assign**: Select from eligible users in the same property
- **Block**: Flag ticket as blocked with reason, blocking user, and department
- **Unblock**: Resolve the block with optional note
- **Reopen**: Return completed ticket to OPEN status

## Ticket Blocking

A ticket can be blocked when work cannot proceed:

1. Assignee or manager creates a block with:
   - Blocking user (who needs to act)
   - Department responsible
   - Reason text
2. Block is stored in `TicketBlock` table
3. Blocking user gets a notification
4. Ticket shows "Blocked" indicator in UI
5. To unblock: blocking user, original reporter, or manager resolves with a note
6. Resolution tracked with `resolvedAt`, `resolvedById`, `resolvedNote`

## Image Storage

Images are stored as a JSON array in the `imagePath` string field:
```json
["uploads/1712345678-image1.jpg", "uploads/1712345679-image2.png"]
```

The `parseImagePaths()` utility handles backward compatibility:
- `null` -> empty array
- `"uploads/single.jpg"` -> `["uploads/single.jpg"]`
- `'["a.jpg","b.jpg"]'` -> `["a.jpg", "b.jpg"]`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/tickets | List (filtered, paginated) |
| GET | /api/tickets/:id | Get detail with relations |
| POST | /api/tickets | Create (multipart, up to 5 images) |
| PUT | /api/tickets/:id | Update (multipart) |
| DELETE | /api/tickets/:id/images | Remove specific image |
| PATCH | /api/tickets/:id/status | Update status |
| POST | /api/tickets/:id/comments | Add comment |
| PUT | /api/tickets/:id/comments/:commentId | Edit comment (15-min window) |
| DELETE | /api/tickets/:id/comments/:commentId | Delete comment (15-min window) |
| PATCH | /api/tickets/:id/assign | Assign to user |
| GET | /api/tickets/:id/assignable-users | Eligible assignees |
| GET | /api/tickets/:id/related | Related tickets |
| POST | /api/tickets/:id/block | Block ticket |
| POST | /api/tickets/:id/unblock | Unblock ticket |

## Notifications Triggered

- `TICKET_ASSIGNED` - When ticket is assigned/reassigned
- `TICKET_REASSIGNED_AWAY` - Previous assignee notified of reassignment
- `TICKET_STATUS_CHANGED` - Creator and assignee notified
- `TICKET_COMMENT` - Relevant parties notified of new comment
- `TICKET_CREATED_IN_PROPERTY` - Property viewers notified of new ticket
- `TICKET_EDITED` - Assignee notified of detail changes
- `TICKET_MENTION` - Users mentioned in comments via @mention
- `TICKET_BLOCKED` - Blocking user notified
- `TICKET_UNBLOCKED` - Block raiser notified
- `TICKET_OVERDUE` - Assignee and managers notified (hourly check)
- `TICKET_DUE_SOON` - Assignee notified 24h before due (hourly check)
- `TICKET_OVERDUE_ESCALATION` - Manager chain notified for prolonged overdue
