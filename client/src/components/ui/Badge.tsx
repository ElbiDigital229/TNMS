import { STATUS_COLOR, PRIORITY_COLOR, CONDITION_COLOR, URGENCY_COLOR } from "../../lib/styles";
import {
  TICKET_STATUS_LABELS,
  PRIORITY_LABELS,
  CONDITION_LABELS,
  URGENCY_LABELS,
} from "../../../../shared/types";

interface BadgeProps {
  children: React.ReactNode;
  color?: string; // tailwind bg + text classes
  className?: string;
}

/** Generic badge — pass your own color classes */
export function Badge({ children, color = "bg-gray-100 text-gray-600", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex rounded-full px-1.5 py-px text-[11px] font-medium leading-4 ${color} ${className}`}>
      {children}
    </span>
  );
}

/** Status badge — auto-maps status key to color + label */
export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <Badge color={STATUS_COLOR[status] || "bg-gray-100 text-gray-600"} className={className}>
      {TICKET_STATUS_LABELS[status] || status}
    </Badge>
  );
}

/** Priority badge — auto-maps priority key to color + label */
export function PriorityBadge({ priority, className = "" }: { priority: string; className?: string }) {
  return (
    <Badge color={PRIORITY_COLOR[priority] || "bg-gray-100 text-gray-600"} className={className}>
      {PRIORITY_LABELS[priority] || priority}
    </Badge>
  );
}

/** Condition badge for assets */
export function ConditionBadge({ condition, className = "" }: { condition: string; className?: string }) {
  return (
    <Badge color={CONDITION_COLOR[condition] || "bg-gray-100 text-gray-600"} className={className}>
      {CONDITION_LABELS[condition] || condition}
    </Badge>
  );
}

/** Urgency badge — computed from due date, shows Overdue / Due Today / Upcoming */
export function UrgencyBadge({ urgency, className = "" }: { urgency: string | null; className?: string }) {
  if (!urgency || urgency === "UPCOMING") return null;
  return (
    <Badge color={URGENCY_COLOR[urgency] || "bg-gray-100 text-gray-600"} className={className}>
      {URGENCY_LABELS[urgency] || urgency}
    </Badge>
  );
}

/** Active/Inactive badge */
export function ActiveBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <Badge color={STATUS_COLOR[status] || "bg-gray-100 text-gray-600"} className={className}>
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </Badge>
  );
}
