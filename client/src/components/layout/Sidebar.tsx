import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Building2,
  Package,
  ClipboardList,
  CalendarClock,
  Settings,
  Layers,
  Tag,
  BadgeCheck,
  TicketCheck,
  CheckSquare,
  BarChart3,
  Users,
  Shield,
  ScrollText,
  LogOut,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { PERMISSIONS } from "../../../../shared/permissions";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout, hasPermission, hasAnyPermission } = useAuth();
  const location = useLocation();
  const isOnSettingsPage = location.pathname.startsWith("/settings");
  const [settingsOpen, setSettingsOpen] = useState(isOnSettingsPage);

  // Auto-expand settings section when navigating to a settings page
  useEffect(() => {
    if (isOnSettingsPage && !settingsOpen) setSettingsOpen(true);
  }, [isOnSettingsPage]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
      isActive
        ? "bg-sidebar-active text-white"
        : "text-sidebar-text hover:bg-sidebar-hover hover:text-gray-200"
    }`;

  const P = PERMISSIONS;

  const hasAnySettingsPermission = hasAnyPermission(
    P.SETTINGS.AREA_GROUPS_MANAGE,
    P.SETTINGS.ASSET_CATEGORIES_MANAGE,
    P.SETTINGS.TICKET_CATEGORIES_MANAGE,
    P.SETTINGS.DEPARTMENTS_MANAGE,
    P.USERS.VIEW,
    P.ROLES.VIEW,
    P.AUDIT.VIEW
  );

  return (
    <>
      {/* Mobile overlay — only between md and lg (tablet). On <md we use bottom tab bar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 hidden bg-sidebar/60 backdrop-blur-sm md:block lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden w-[230px] flex-col bg-sidebar transition-transform duration-300 ease-in-out md:flex lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="text-[15px] font-semibold text-white">TNMS</span>
          </Link>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/50">
            Main
          </div>
          <div className="space-y-0.5">
            {hasPermission(P.DASHBOARD.VIEW) && (
              <NavLink to="/" end className={linkClass} onClick={onClose}>
                <LayoutDashboard size={18} />
                Dashboard
              </NavLink>
            )}

            {hasAnyPermission(P.TICKETS.VIEW_ALL, P.TICKETS.VIEW_ASSIGNED) && (
              <NavLink to="/tickets" className={linkClass} onClick={onClose}>
                <ClipboardList size={18} />
                Tickets
              </NavLink>
            )}

            {hasPermission(P.TICKETS.CREATE) && (
              <NavLink to="/ticket-schedules" className={linkClass} onClick={onClose}>
                <CalendarClock size={18} />
                Schedules
              </NavLink>
            )}

            {hasPermission(P.PROPERTIES.VIEW) && (
              <NavLink to="/properties" className={linkClass} onClick={onClose}>
                <Building2 size={18} />
                Properties
              </NavLink>
            )}

            {hasPermission(P.ASSETS.VIEW) && (
              <NavLink to="/assets" className={linkClass} onClick={onClose}>
                <Package size={18} />
                Assets
              </NavLink>
            )}

            {hasPermission(P.UNITS.VIEW) && (
              <NavLink to="/units" className={linkClass} onClick={onClose}>
                <Layers size={18} />
                Units
              </NavLink>
            )}

            {hasPermission(P.TODOS.ACCESS) && (
              <NavLink to="/todos" className={linkClass} onClick={onClose}>
                <CheckSquare size={18} />
                To-Do List
              </NavLink>
            )}

            {hasPermission(P.REPORTS.VIEW) && (
              <NavLink to="/reports" className={linkClass} onClick={onClose}>
                <BarChart3 size={18} />
                Reports
              </NavLink>
            )}
          </div>

          {hasAnySettingsPermission && (
            <>
              <div className="mb-1.5 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/50">
                Configuration
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    isOnSettingsPage
                      ? "bg-sidebar-active text-white"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-gray-200"
                  }`}
                >
                  <Settings size={18} />
                  Settings
                  <svg
                    className={`ml-auto h-4 w-4 text-gray-600 transition-transform duration-200 ${settingsOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {settingsOpen && (
                  <div className="ml-3 space-y-0.5 border-l border-sidebar-border pl-3">
                    {hasPermission(P.SETTINGS.AREA_GROUPS_MANAGE) && (
                      <NavLink
                        to="/settings/area-groups"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <Layers size={16} />
                        Area Grouping
                      </NavLink>
                    )}
                    {hasPermission(P.SETTINGS.ASSET_CATEGORIES_MANAGE) && (
                      <NavLink
                        to="/settings/asset-categories"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <Tag size={16} />
                        Asset Categories
                      </NavLink>
                    )}
                    {hasPermission(P.SETTINGS.TICKET_CATEGORIES_MANAGE) && (
                      <NavLink
                        to="/settings/ticket-categories"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <TicketCheck size={16} />
                        Ticket Categories
                      </NavLink>
                    )}
                    {hasPermission(P.SETTINGS.DEPARTMENTS_MANAGE) && (
                      <NavLink
                        to="/settings/departments"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <Building2 size={16} />
                        Departments
                      </NavLink>
                    )}
                    {hasPermission(P.SETTINGS.DESIGNATIONS_MANAGE) && (
                      <NavLink
                        to="/settings/designations"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <BadgeCheck size={16} />
                        Designations
                      </NavLink>
                    )}
                    {hasPermission(P.USERS.VIEW) && (
                      <NavLink
                        to="/settings/users"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <Users size={16} />
                        Users
                      </NavLink>
                    )}
                    {hasPermission(P.ROLES.VIEW) && (
                      <NavLink
                        to="/settings/roles"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <Shield size={16} />
                        Roles
                      </NavLink>
                    )}
                    {hasPermission(P.AUDIT.VIEW) && (
                      <NavLink
                        to="/settings/audit-logs"
                        className={linkClass}
                        onClick={onClose}
                      >
                        <ScrollText size={16} />
                        Audit Log
                      </NavLink>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-sidebar-text transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
