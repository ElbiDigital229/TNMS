# TNMS – Ticket Module

## Overview
Core execution engine.

## Fields
- Ticket Code (auto)
- Name
- Description
- Images
- Property (required)
- Type (settings)
- Subtype (settings)
- Department (optional)
- User (optional)
- Due Date (required)
- Recurring (optional)

## Assignment Logic
- No assignment → Unassigned
- Department only → Manager owns
- Department + User → Assigned

## States
- Unassigned
- Assigned
- In Progress
- Blocked
- Completed
- Overdue

## Blocker
- Can mark ticket blocked
- Select department/user
- Add reason
