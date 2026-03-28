import { NavLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Building2,
  Package,
  ClipboardList,
  Settings,
  Layers,
  Tag,
  TicketCheck,
  CheckSquare,
  BarChart3,
  Users,
  Shield,
  ScrollText,
  LogOut,
  X,
} from "lucide-react";
import { useState } from "react";
import { PERMISSIONS } from "../../../../shared/permissions";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { logout, hasPermission, hasAnyPermission } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-200 ${
      isActive
        ? "bg-white/10 text-white"
        : "text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
    }`;

  const P = PERMISSIONS;

  const hasAnySettingsPermission = hasAnyPermission(
    P.SETTINGS.AREA_GROUPS_MANAGE,
    P.SETTINGS.ASSET_CATEGORIES_MANAGE,
    P.SETTINGS.TICKET_CATEGORIES_MANAGE,
    P.USERS.VIEW,
    P.ROLES.VIEW,
    P.AUDIT.VIEW
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-950/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#0C111D] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="text-[15px] font-semibold text-white">TNMS</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
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
              <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                Configuration
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-gray-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-gray-200"
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
                  <div className="ml-3 space-y-0.5 border-l border-white/[0.06] pl-3">
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
        <div className="border-t border-white/[0.08] p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-gray-500 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
