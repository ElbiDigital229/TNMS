# Notifications

## Route

`/notifications`

## Overview

TNMS has a comprehensive notification system with 19 event types. Notifications are stored in the database for in-app display and optionally pushed to mobile devices via Firebase Cloud Messaging (FCM).

## Notification Types

### Ticket Events
| Type | Trigger | Recipients |
|------|---------|-----------|
| TICKET_ASSIGNED | Ticket assigned to user | Assignee |
| TICKET_REASSIGNED_AWAY | Ticket reassigned to someone else | Previous assignee |
| TICKET_STATUS_CHANGED | Status updated | Creator + assignee |
| TICKET_COMMENT | New comment added | Creator + assignee (excluding commenter) |
| TICKET_CREATED_IN_PROPERTY | New ticket created | Users with VIEW_ALL in that property |
| TICKET_EDITED | Ticket details modified | Assignee |
| TICKET_MENTION | @mentioned in a comment | Mentioned users |
| TICKET_BLOCKED | Ticket blocked | Blocking user |
| TICKET_UNBLOCKED | Block resolved | User who raised the block |
| TICKET_OVERDUE | Ticket past due date | Assignee |
| TICKET_DUE_SOON | Ticket due within 24h | Assignee |
| TICKET_OVERDUE_ESCALATION | Ticket overdue 3+ days | Manager chain |

### Asset Events
| Type | Trigger | Recipients |
|------|---------|-----------|
| ASSET_CONDITION_POOR | Asset marked as POOR condition | Property ticket viewers |

### Property Events
| Type | Trigger | Recipients |
|------|---------|-----------|
| PROPERTY_DEACTIVATED | Property deactivated | All assigned users |

### User Events
| Type | Trigger | Recipients |
|------|---------|-----------|
| USER_ACCOUNT_CHANGED | User profile updated | The user |
| USER_PASSWORD_RESET | Password reset | The user |
| USER_STATUS_CHANGED | Account activated/deactivated/blocked | The user + their manager |
| USER_NEW_SUBORDINATE | New direct report assigned | The manager |
| USER_CREATED_UNDER_YOU | New user reports to you | The manager |

## Notification Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| userId | UUID | Recipient user |
| type | Enum | One of the 19 notification types |
| title | String | Notification headline |
| message | String | Notification body text |
| metadata | JSON? | Extra data (ticketId, ticketNumber, propertyName, etc.) |
| isRead | Boolean | Read/unread status |
| createdAt | DateTime | When notification was created |

## Notification Page Features

- List of all notifications, newest first
- Unread count badge in navigation
- Mark individual as read (click)
- Mark all as read
- Notification metadata enables deep linking (click to navigate to ticket, etc.)

## Scheduled Checks

Two background jobs run every 60 minutes (via `setInterval` in server/index.ts):

1. **Overdue Check** (`checkOverdueTickets`)
   - Finds tickets past due date that aren't completed
   - Updates status to OVERDUE if not already
   - Sends TICKET_OVERDUE notification to assignee
   - Sends TICKET_OVERDUE_ESCALATION to manager chain for tickets overdue 3+ days
   - Deduplicates: won't re-notify if already notified same day

2. **Due Soon Check** (`checkDueSoonTickets`)
   - Finds tickets due within next 24 hours
   - Sends TICKET_DUE_SOON notification to assignee
   - Deduplicates: won't re-notify if already notified same day

## Push Notifications (FCM)

### Device Token Management
- Mobile app registers device token via `POST /api/notifications/device-token`
- Token stored in `DeviceToken` table linked to user
- Token removed on logout via `DELETE /api/notifications/device-token`

### Push Delivery
- When a notification is created, FCM push is attempted if user has registered device tokens
- Push includes title, body, and metadata for deep linking
- Push failures are logged but don't prevent in-app notification creation

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/notifications | List user's notifications (paginated) |
| GET | /api/notifications/unread-count | Get unread count |
| PATCH | /api/notifications/:id/read | Mark as read |
| PATCH | /api/notifications/read-all | Mark all as read |
| POST | /api/notifications/device-token | Register FCM token |
| DELETE | /api/notifications/device-token | Unregister FCM token |
| POST | /api/notifications/run-scheduled-checks | Manual trigger for overdue/due-soon checks |

## Architecture Notes

- Notifications are fire-and-forget: triggered with `.catch(console.error)` so failures don't break the main operation
- The notification trigger service (`notificationTrigger.service.ts`) is called from controllers/services throughout the app
- Metadata is stored as JSON to support different notification types with different context data
