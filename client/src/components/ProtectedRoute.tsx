import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/** Dismiss the HTML splash screen (defined in index.html) */
function dismissSplash() {
  const el = document.getElementById("splash");
  if (el) {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 500);
  }
}

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) dismissSplash();
  }, [isLoading]);

  if (isLoading) return null; // splash is still visible

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
