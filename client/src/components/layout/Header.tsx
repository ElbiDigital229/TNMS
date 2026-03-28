import { Menu, User } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import NotificationBell from "./NotificationBell";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200/80 bg-white px-6">
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 ring-1 ring-primary-100">
            <User size={14} className="text-primary-600" />
          </div>
          <span className="text-[13px] font-medium text-gray-600">
            {user?.username}
          </span>
        </div>
      </div>
    </header>
  );
}
