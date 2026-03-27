import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";

interface PermissionGateProps {
  permission?: string;
  any?: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PermissionGate({
  permission,
  any,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission } = useAuth();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (any && !hasAnyPermission(...any)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
