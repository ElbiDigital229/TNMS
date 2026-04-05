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

const TEST_USERS = [
  { username: "admin", label: "Admin (Super Admin)" },
  { username: "ceo", label: "Imran Khan (CEO)" },
  { username: "opslead", label: "Ahmed Raza (OPS Lead)" },
  { username: "dh", label: "Faisal Mahmood (District Head)" },
  { username: "ch_north", label: "Bilal Siddiqui (City Head - North)" },
  { username: "ch_central", label: "Usman Tariq (City Head - Central)" },
  { username: "ce_north1", label: "Saad Ali (CE - North / Alpha)" },
  { username: "ce_north2", label: "Zainab Hussain (CE - North / Vanguard)" },
  { username: "ce_central1", label: "Ayesha Malik (CE - Central / Boulevard)" },
  { username: "ce_central2", label: "Hassan Javed (CE - Central / Downtown)" },
  { username: "fm_north", label: "Kamran Akbar (FM - North)" },
  { username: "fm_central", label: "Nadia Butt (FM - Central)" },
  { username: "sup_north", label: "Tariq Mehmood (Supervisor - North)" },
  { username: "sup_central", label: "Waqas Shah (Supervisor - Central)" },
  { username: "tech_north1", label: "Asif Raza (Tech - North)" },
  { username: "tech_north2", label: "Mohsin Ali (Tech - North)" },
  { username: "tech_central1", label: "Rizwan Ahmed (Tech - Central)" },
  { username: "tech_central2", label: "Farhan Iqbal (Tech - Central)" },
];

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

  const quickLogin = async (un: string) => {
    setError("");
    setLoading(true);
    try {
      await login(un, "admin");
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0C111D] px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-lg bg-white p-5 shadow-2xl ring-1 ring-white/10 animate-scale-in">
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

          {/* Quick Login Dropdown */}
          <div className="mb-3">
            <label className={cls.label}>
              Quick Login (dev)
            </label>
            <select
              onChange={(e) => { if (e.target.value) quickLogin(e.target.value); }}
              disabled={loading}
              className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-[13px] shadow-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:opacity-50"
              defaultValue=""
            >
              <option value="">Select a user to login as...</option>
              {TEST_USERS.map((u) => (
                <option key={u.username} value={u.username}>{u.label}</option>
              ))}
            </select>
          </div>

          <div className="relative mb-3">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-gray-400">or sign in manually</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={cls.label}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={cls.input}
                placeholder="Enter username"
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
