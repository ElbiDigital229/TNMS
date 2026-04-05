import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Bell,
  User,
  Check,
  CheckCheck,
  Ticket,
  MessageSquare,
  UserCog,
  AlertTriangle,
  Building2,
  X,
  Inbox,
  LogOut,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import { useAuth } from "../../contexts/AuthContext";
import { PERMISSIONS } from "../../../../shared/permissions";

// ── Notification type config ──
const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
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

// Routes where the tab bar should be hidden (detail/child pages)
function isChildPage(pathname: string): boolean {
  // Ticket detail, edit, create
  if (/^\/tickets\/[^/]+$/.test(pathname) && !pathname.endsWith("/new")) return true;
  if (/^\/tickets\/[^/]+\/edit$/.test(pathname)) return true;
  // Property detail, edit, create
  if (/^\/properties\/[^/]+$/.test(pathname) && !pathname.endsWith("/new")) return true;
  if (/^\/properties\/[^/]+\/edit$/.test(pathname)) return true;
  // Asset detail
  if (/^\/assets\/[^/]+$/.test(pathname)) return true;
  if (/^\/asset-view\/[^/]+$/.test(pathname)) return true;
  // Report detail
  if (/^\/reports\/[^/]+\/[^/]+$/.test(pathname)) return true;
  // Settings sub-pages
  if (pathname.startsWith("/settings/")) return true;
  return false;
}

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount, notifications, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const { logout, user, hasPermission } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifClosing, setNotifClosing] = useState(false);

  const hideTabBar = isChildPage(location.pathname);

  const tabClass = (isActive: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
      isActive ? "text-white" : "text-sidebar-text"
    }`;

  // Lock body scroll when notification overlay is open
  useEffect(() => {
    if (!notifOpen) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [notifOpen]);

  const closeNotifOverlay = useCallback(() => {
    setNotifClosing(true);
    setTimeout(() => {
      setNotifOpen(false);
      setNotifClosing(false);
    }, 200);
  }, []);

  const handleNotificationClick = async (n: (typeof notifications)[0]) => {
    if (!n.isRead) await markAsRead(n.id);
    closeNotifOverlay();
    if (n.linkUrl) navigate(n.linkUrl);
  };

  const handleViewAll = () => {
    closeNotifOverlay();
    navigate("/notifications");
  };

  // Get user initials
  const initials = user?.fullName
    ? user.fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || "?";

  return (
    <>
      {/* ── Profile bottom sheet ── */}
      {profileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setProfileOpen(false)} />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-xl animate-slide-up"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <span className="text-sm font-semibold text-gray-900">Profile</span>
              <button
                onClick={() => setProfileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"
              >
                <X size={16} />
              </button>
            </div>

            {/* User info */}
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-sm font-bold">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user?.fullName || user?.username || "User"}
                </p>
                {user?.role?.name && (
                  <span className="mt-0.5 inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
                    {user.role.name}
                  </span>
                )}
                {user?.email && (
                  <p className="mt-0.5 text-xs text-gray-400 truncate">{user.email}</p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 p-3">
              <button
                onClick={() => { setProfileOpen(false); logout(); }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-red-600 active:bg-red-50"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notification Full-Screen Overlay ── */}
      {notifOpen && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col bg-white md:hidden transition-transform duration-200 ease-out ${
            notifClosing ? "translate-y-full" : "translate-y-0 animate-slide-up"
          }`}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3.5">
            <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary-600 active:text-primary-700"
                >
                  <CheckCheck size={15} />
                  Mark all read
                </button>
              )}
              <button
                onClick={closeNotifOverlay}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 active:bg-gray-200"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain">
            {isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500" />
                <p className="mt-3 text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Inbox size={48} className="mb-3 text-gray-200" />
                <p className="text-sm font-medium text-gray-400">No notifications</p>
                <p className="mt-1 text-xs text-gray-300">You're all caught up</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {notifications.map((n) => {
                    const config = TYPE_CONFIG[n.type] || { icon: Bell, color: "text-gray-600", bg: "bg-gray-50" };
                    const Icon = config.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors active:bg-gray-50 ${
                          !n.isRead ? "border-l-[3px] border-l-primary-500 bg-primary-50/30" : "border-l-[3px] border-l-transparent"
                        }`}
                      >
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                          <Icon size={16} className={config.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-500">{n.message}</p>
                          <p className="mt-1 text-xs text-gray-400">{timeAgo(n.createdAt)}</p>
                        </div>
                        {!n.isRead && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                            className="mt-1.5 shrink-0 rounded p-1.5 text-gray-300 active:bg-gray-100 hover:text-gray-500"
                            title="Mark as read"
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-gray-100 px-5 py-4">
                  <button
                    onClick={handleViewAll}
                    className="w-full rounded-xl bg-gray-50 py-3 text-center text-sm font-medium text-primary-600 active:bg-gray-100"
                  >
                    View all notifications
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab Bar (hidden on child/detail pages) ── */}
      {!hideTabBar && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <nav className="flex">
            {hasPermission(PERMISSIONS.DASHBOARD.VIEW) && (
              <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}>
                <LayoutDashboard size={20} />
                Home
              </NavLink>
            )}

            <NavLink
              to="/tickets"
              className={({ isActive }) => tabClass(isActive || location.pathname.startsWith("/tickets"))}
            >
              <ClipboardList size={20} />
              Tickets
            </NavLink>

            <NavLink to="/todos" className={({ isActive }) => tabClass(isActive)}>
              <CheckSquare size={20} />
              To-Do
            </NavLink>

            <button
              onClick={() => { setNotifClosing(false); setNotifOpen(true); }}
              className={tabClass(false)}
            >
              <div className="relative">
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              Alerts
            </button>

            <button onClick={() => setProfileOpen(true)} className={tabClass(false)}>
              <User size={20} />
              Profile
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
