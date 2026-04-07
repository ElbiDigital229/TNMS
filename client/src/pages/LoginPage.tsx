import { useState, useEffect, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Building2 } from "lucide-react";
import { cls } from "../lib/styles";
import axios from "axios";

function dismissSplash() {
  const el = document.getElementById("splash");
  if (el) {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 500);
  }
}

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) dismissSplash();
  }, [isLoading]);

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white sm:bg-[#0C111D] sm:px-4">
      <div className="w-full sm:max-w-sm">
        <div className="min-h-screen sm:min-h-0 bg-white p-6 sm:rounded-lg sm:p-5 sm:shadow-2xl sm:ring-1 sm:ring-white/10 animate-scale-in flex flex-col justify-center sm:block">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 shadow-lg shadow-primary-600/30">
              <Building2 size={20} className="text-white" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">
              Welcome back
            </h1>
            <p className="mt-0.5 text-[12px] text-gray-500">
              Sign in to your account
            </p>
          </div>

          {error && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={cls.label}>Email</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cls.input}
                placeholder="Enter email"
                required
              />
            </div>

            <div>
              <label className={cls.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cls.input}
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${cls.btnPrimary} justify-center py-2`}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
