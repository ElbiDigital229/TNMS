import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Shield } from "lucide-react";

interface RequirePermissionProps {
  permission?: string;
  any?: string[];
  children: ReactNode;
}

export default function RequirePermission({
  permission,
  any,
  children,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission } = useAuth();

  const allowed =
    (permission && hasPermission(permission)) ||
    (any && hasAnyPermission(...any)) ||
    (!permission && !any);

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield size={48} className="text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-700">
          Access Denied
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
