# TNMS – Business Logic & Product Vision

## Goal

Track accountability, not just completion. TNMS exists so leadership can see not only what work is being done, but who is responsible, where delays happen, and why.

## Core Principle

Delay is not failure — untracked delay is.

A ticket sitting blocked for 3 days is acceptable if the system shows exactly who is blocking it, which department owns the bottleneck, and when it was flagged. An untracked 3-day delay is unacceptable because nobody learns from it.

## The Accountability Chain

Every ticket flows through a chain of ownership:

```
Ticket Created
  → Assigned to Department + User
    → Work Begins (In Progress)
      → Blocker Raised (if needed)
        → Blocker Resolved
      → Work Completed
```

At every step, the system records WHO did WHAT and WHEN:
- Who created it and when
- Who it was assigned to and by whom
- When status changed and who changed it
- Who raised a blocker, against which department/person, and why
- Who resolved the blocker and how
- When it was completed and whether it met the SLA

## Assignment Logic

Tickets always belong to a **property** and **unit**. Assignment follows this pattern:

| Scenario | Ownership | Visibility |
|----------|-----------|-----------|
| No assignee set | Department manager owns it | Visible to property viewers |
| Department + User assigned | That user is accountable | Visible to assignee, creator, property viewers |
| Reassigned | New assignee takes over, old one notified | Full history preserved in activity log |

## SLA & Due Dates

Every ticket has a due date. The system continuously tracks:
- **Time elapsed** vs. total SLA window
- **Color-coded urgency**: green (on track) → amber (getting close) → red (critical/overdue)
- **Overdue escalation**: if a ticket passes its due date, the assignee is notified. After 3+ days overdue, the manager chain is escalated automatically.

The SLA bar is visible on every ticket — there's no hiding from a deadline.

## Blocker System

When work can't proceed, the assignee (or a manager) raises a blocker:

1. **Who is blocking?** — Select the department or user responsible
2. **Why?** — Mandatory reason text
3. **What happens?** — The blocking party is notified and the ticket is visually flagged
4. **Resolution** — The blocker must be explicitly resolved with a note explaining how

This creates a clear record: "Ticket #247 was blocked for 5 days waiting on Electrical department because parts were on backorder." That data feeds into department performance reports.

## What Leadership Can See

### Per-User Insights
- How many tickets assigned vs. completed
- Average resolution time
- SLA compliance rate
- Number of times they were the blocker

### Per-Department Insights
- Ticket volume and completion rate
- How often the department blocks other teams
- Average time to resolve blocks raised against them

### Per-Property Insights
- Ticket volume by type and priority
- Asset health (condition breakdown)
- Which units generate the most work orders

### System-Wide
- Overall SLA compliance trend over time
- Priority distribution (are we dealing with too many critical issues?)
- Ticket creation trend (is workload increasing?)
- Top performers and bottleneck departments

## Notification Philosophy

The system proactively pushes information to the right people:
- **Assignee** knows immediately when they get a ticket
- **Creator** knows when their ticket progresses
- **Managers** get escalations for overdue work they didn't know about
- **Blocking parties** can't ignore a block request — it's in their notifications
- **@mentioned users** in comments are pulled into the conversation

Nobody can claim "I didn't know about it."

## Recurring Work

Maintenance and inspections can be set as recurring (daily/weekly/monthly). This ensures preventive work doesn't fall through the cracks — the system generates tickets on schedule rather than relying on someone to remember.

## Audit Trail

Every action is logged with the user, timestamp, and IP address. This isn't just for compliance — it answers the question "who changed this and when?" definitively. No disputes, no finger-pointing, just facts.

## The Bottom Line

TNMS turns property management from "I think things are running fine" into "I can see exactly how things are running, who is performing, and where the problems are."
