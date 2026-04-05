import { Menu, User } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import NotificationBell from "./NotificationBell";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="relative z-20 flex h-12 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Hamburger — desktop only (mobile uses bottom tab bar) */}
      <button
        onClick={onMenuClick}
        className="hidden rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden md:block"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {/* Notification bell — hidden on mobile (moved to tab bar) */}
        <div className="relative hidden md:block">
          <NotificationBell />
        </div>
        <div className="hidden items-center gap-2.5 md:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100">
            <User size={14} className="text-primary-600" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-gray-700">
              {user?.fullName || user?.username}
            </span>
            {user?.role?.name && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                {user.role.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
