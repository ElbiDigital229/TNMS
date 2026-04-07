export const CITY_CODES: Record<string, string> = {
  LAHORE: "LHR",
  ISLAMABAD: "ISB",
};

export const CITY_LABELS: Record<string, string> = {
  LAHORE: "Lahore",
  ISLAMABAD: "Islamabad",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  FLOOR: "Floor",
  BUILDING: "Building",
  COMPOUND: "Compound",
};

export const CONDITION_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  COMPLAIN: "Complain",
  MAINTENANCE: "Maintenance",
  INSPECT: "Inspect",
  TASK: "Task",
};

export const SUB_TASK_TYPE_LABELS: Record<string, string> = {
  REACTIVE: "Reactive",
  PREVENTIVE: "Preventive",
};

export const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  UNASSIGNED: "Unassigned",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
};

export const URGENCY_LABELS: Record<string, string> = {
  OVERDUE: "Overdue",
  DUE_TODAY: "Due Today",
  UPCOMING: "Upcoming",
};

/** Compute urgency from due date (client-side, never stored) */
export function computeUrgency(dueDate: string | Date | null | undefined, status: string): "OVERDUE" | "DUE_TODAY" | "UPCOMING" | null {
  if (status === "COMPLETED") return null;
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  if (due < startOfToday) return "OVERDUE";
  if (due < endOfToday) return "DUE_TODAY";
  return "UPCOMING";
}

export const RECURRING_TYPE_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
