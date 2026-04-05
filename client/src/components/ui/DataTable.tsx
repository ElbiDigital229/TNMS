import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

// ── Pagination ──
interface PaginationData {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

interface PaginationProps {
  pagination: PaginationData;
  onPageChange: (page: number) => void;
}

export function Pagination({ pagination, onPageChange }: PaginationProps) {
  if (pagination.totalPages <= 1) return null;
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
      <span className="text-[12px] text-gray-500">
        {start}–{end} of {pagination.total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={pagination.page === 1}
          className="rounded-md border border-gray-200 p-1 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[12px] font-medium text-gray-600">
          {pagination.page}/{pagination.totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
          disabled={pagination.page === pagination.totalPages}
          className="rounded-md border border-gray-200 p-1 hover:bg-gray-50 disabled:opacity-40 transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Empty State ──
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="mb-2 text-gray-300">{icon}</div>
      <p className="text-[13px] font-medium text-gray-500">{title}</p>
      {subtitle && <p className="mt-0.5 text-[12px] text-gray-400">{subtitle}</p>}
    </div>
  );
}

// ── Loading Spinner ──
export function TableLoading() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
    </div>
  );
}
