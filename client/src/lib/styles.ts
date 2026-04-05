/**
 * Centralized style constants and helpers.
 * Every page should import from here instead of defining inline color fns.
 */

// ── Status badge colors ──
export const STATUS_COLOR: Record<string, string> = {
  UNASSIGNED: "bg-gray-100 text-gray-600",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  BLOCKED: "bg-orange-50 text-orange-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  INACTIVE: "bg-gray-100 text-gray-500",
};

export const URGENCY_COLOR: Record<string, string> = {
  OVERDUE: "bg-red-50 text-red-700",
  DUE_TODAY: "bg-amber-50 text-amber-700",
  UPCOMING: "bg-sky-50 text-sky-700",
};

export const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700",
  HIGH: "bg-orange-50 text-orange-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  LOW: "bg-sky-50 text-sky-700",
};

export const CONDITION_COLOR: Record<string, string> = {
  EXCELLENT: "bg-emerald-50 text-emerald-700",
  GOOD: "bg-sky-50 text-sky-700",
  FAIR: "bg-amber-50 text-amber-700",
  POOR: "bg-red-50 text-red-700",
};

// ── Chart / progress bar fills ──
export const STATUS_BAR: Record<string, string> = {
  UNASSIGNED: "bg-gray-400",
  ASSIGNED: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  BLOCKED: "bg-orange-500",
  COMPLETED: "bg-emerald-500",
};

export const PRIORITY_BAR: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-sky-500",
};

export const TASK_TYPE_BAR: Record<string, string> = {
  COMPLAIN: "bg-red-500",
  MAINTENANCE: "bg-orange-500",
  INSPECT: "bg-violet-500",
  TASK: "bg-sky-500",
};

// ── Reusable class strings (compact) ──
export const cls = {
  // Page header
  pageTitle: "text-lg font-semibold text-gray-900",
  pageSub: "text-xs text-gray-500",

  // Cards
  card: "rounded-lg bg-white ring-1 ring-gray-200",
  cardPad: "p-4",

  // Tables
  table: "w-full text-[13px]",
  th: "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400",
  td: "px-3 py-2",
  tr: "border-b border-gray-100 transition-colors hover:bg-gray-50/60",
  trClick: "cursor-pointer border-b border-gray-100 transition-colors hover:bg-primary-50/30",

  // Buttons
  btnPrimary:
    "inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors",
  btnSecondary:
    "inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors",
  btnDanger:
    "inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors",
  btnGhost:
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:bg-gray-100 transition-colors",
  btnIcon:
    "rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors",

  // Inputs
  input:
    "w-full rounded-md border border-gray-300 px-3 py-1.5 text-[13px] shadow-sm placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
  select:
    "rounded-md border border-gray-300 px-3 py-1.5 text-[13px] shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",
  label: "mb-1 block text-[12px] font-medium text-gray-600",
  textarea:
    "w-full rounded-md border border-gray-300 px-3 py-1.5 text-[13px] shadow-sm placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100",

  // Badges
  badge: "inline-flex rounded-full px-1.5 py-px text-[11px] font-medium",
  badgeDot: "inline-flex items-center gap-1 text-[11px] font-medium",

  // Pagination
  paginationBtn:
    "rounded-md border border-gray-200 p-1 hover:bg-gray-50 disabled:opacity-40 transition-colors",

  // Layout
  section: "mb-4",

  // Mono ID
  mono: "font-mono text-[12px] font-medium text-primary-600",

  // Links
  link: "text-primary-600 hover:text-primary-700 hover:underline",

  // Empty state
  emptyIcon: "mx-auto mb-2 text-gray-300",
  emptyTitle: "text-[13px] font-medium text-gray-500",
  emptySub: "text-[12px] text-gray-400",
} as const;
