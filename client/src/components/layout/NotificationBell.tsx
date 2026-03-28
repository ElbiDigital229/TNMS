import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  Ticket,
  MessageSquare,
  UserCog,
  AlertTriangle,
  Building2,
} from "lucide-react";
import { useNotifications } from "../../contexts/NotificationContext";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bell; color: string; bg: string }
> = {
  TICKET_ASSIGNED: { icon: Ticket, color: "text-blue-600", bg: "bg-blue-50" },
  TICKET_REASSIGNED_AWAY: { icon: Ticket, color: "text-orange-600", bg: "bg-orange-50" },
  TICKET_STATUS_CHANGED: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  TICKET_COMMENT: { icon: MessageSquare, color: "text-violet-600", bg: "bg-violet-50" },
  TICKET_CREATED_IN_PROPERTY: { icon: Building2, color: "text-green-600", bg: "bg-green-50" },
  TICKET_EDITED: { icon: Ticket, color: "text-cyan-600", bg: "bg-cyan-50" },
  TICKET_OVERDUE: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  TICKET_DUE_SOON: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50" },
  TICKET_OVERDUE_ESCALATION: { icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
  ASSET_CONDITION_POOR: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  PROPERTY_DEACTIVATED: { icon: Building2, color: "text-gray-600", bg: "bg-gray-100" },
  USER_ACCOUNT_CHANGED: { icon: UserCog, color: "text-gray-600", bg: "bg-gray-50" },
  USER_PASSWORD_RESET: { icon: UserCog, color: "text-blue-600", bg: "bg-blue-50" },
  USER_STATUS_CHANGED: { icon: UserCog, color: "text-amber-600", bg: "bg-amber-50" },
  USER_NEW_SUBORDINATE: { icon: UserCog, color: "text-green-600", bg: "bg-green-50" },
  USER_CREATED_UNDER_YOU: { icon: UserCog, color: "text-green-600", bg: "bg-green-50" },
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

export default function NotificationBell() {
  const navigate = useNavigate();
  const { unreadCount, notifications, isLoading, markAsRead, markAllAsRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (n: (typeof notifications)[0]) => {
    if (!n.isRead) {
      await markAsRead(n.id);
    }
    setOpen(false);
    if (n.linkUrl) {
      navigate(n.linkUrl);
    }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 rounded-xl bg-white shadow-lg ring-1 ring-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                <CheckCheck size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] || {
                  icon: Bell,
                  color: "text-gray-600",
                  bg: "bg-gray-50",
                };
                const Icon = config.icon;

                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                      !n.isRead ? "border-l-2 border-l-primary-500 bg-primary-50/30" : "border-l-2 border-l-transparent"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                    >
                      <Icon size={14} className={config.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-gray-900 truncate">
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(n.id);
                        }}
                        className="mt-1 shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500"
                        title="Mark as read"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              <button
                onClick={() => {
                  setOpen(false);
                  navigate("/notifications");
                }}
                className="w-full text-center text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
