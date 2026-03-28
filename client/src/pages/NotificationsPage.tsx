import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { notificationApi } from "../lib/api";
import {
  Bell,
  Check,
  CheckCheck,
  Ticket,
  MessageSquare,
  UserCog,
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; bg: string; label: string }
> = {
  TICKET_ASSIGNED: { icon: Ticket, color: "text-blue-600", bg: "bg-blue-50", label: "Ticket Assigned" },
  TICKET_REASSIGNED_AWAY: { icon: Ticket, color: "text-orange-600", bg: "bg-orange-50", label: "Reassigned Away" },
  TICKET_STATUS_CHANGED: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Status Changed" },
  TICKET_COMMENT: { icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-50", label: "Comment" },
  TICKET_CREATED_IN_PROPERTY: { icon: Building2, color: "text-green-600", bg: "bg-green-50", label: "Ticket Created" },
  TICKET_EDITED: { icon: Ticket, color: "text-cyan-600", bg: "bg-cyan-50", label: "Ticket Edited" },
  TICKET_OVERDUE: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "Overdue" },
  TICKET_DUE_SOON: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50", label: "Due Soon" },
  TICKET_OVERDUE_ESCALATION: { icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50", label: "Escalation" },
  ASSET_CONDITION_POOR: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "Poor Asset" },
  PROPERTY_DEACTIVATED: { icon: Building2, color: "text-gray-600", bg: "bg-gray-100", label: "Property Deactivated" },
  USER_ACCOUNT_CHANGED: { icon: UserCog, color: "text-gray-600", bg: "bg-gray-50", label: "Account Update" },
  USER_PASSWORD_RESET: { icon: UserCog, color: "text-blue-600", bg: "bg-blue-50", label: "Password Reset" },
  USER_STATUS_CHANGED: { icon: UserCog, color: "text-amber-600", bg: "bg-amber-50", label: "Status Changed" },
  USER_NEW_SUBORDINATE: { icon: UserCog, color: "text-green-600", bg: "bg-green-50", label: "New Subordinate" },
  USER_CREATED_UNDER_YOU: { icon: UserCog, color: "text-green-600", bg: "bg-green-50", label: "New Team Member" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { refetch: refetchGlobal } = useNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: 20,
  });

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (filter === "unread") params.isRead = "false";
      if (typeFilter) params.type = typeFilter;

      const res = await notificationApi.list(params);
      setNotifications(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [page, filter, typeFilter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    await notificationApi.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      )
    );
    refetchGlobal();
  };

  const handleMarkAllAsRead = async () => {
    await notificationApi.markAllAsRead();
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
    );
    refetchGlobal();
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      await handleMarkAsRead(n.id);
    }
    if (n.linkUrl) {
      navigate(n.linkUrl);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Notifications</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            {pagination.total} {pagination.total === 1 ? "notification" : "notifications"}
          </p>
        </div>
        <button
          onClick={handleMarkAllAsRead}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50"
        >
          <CheckCheck size={16} />
          Mark all as read
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 p-0.5">
          <button
            onClick={() => { setFilter("all"); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all"
                ? "bg-primary-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setFilter("unread"); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "unread"
                ? "bg-primary-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Unread
          </button>
        </div>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>
      </div>

      {/* Notification List */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Bell size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-500">No notifications</p>
            <p className="mt-1 text-[13px] text-gray-400">
              {filter === "unread"
                ? "You're all caught up!"
                : "Notifications will appear here when something happens"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n) => {
              const config = TYPE_CONFIG[n.type] || {
                icon: Bell,
                color: "text-gray-600",
                bg: "bg-gray-50",
                label: n.type,
              };
              const Icon = config.icon;

              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/80 ${
                    !n.isRead ? "bg-primary-50/20" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                  >
                    <Icon size={18} className={config.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                      )}
                      <span className="ml-auto shrink-0 text-xs text-gray-400">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-gray-500">
                      {n.message}
                    </p>
                    <span
                      className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${config.bg} ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(n.id);
                      }}
                      className="mt-1 shrink-0 rounded-md p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                      title="Mark as read"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="rounded-lg border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
