import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface StatCardProps {
  to: string;
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  valueColor?: string;
}

export default function StatCard({ to, icon, iconBg, label, value, valueColor = "text-gray-900" }: StatCardProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg bg-white p-3.5 ring-1 ring-gray-200 transition-all hover:ring-gray-300 hover:shadow-sm"
    >
      <div className={`rounded-md p-2 ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-[12px] text-gray-500">{label}</p>
        <p className={`text-xl font-semibold ${valueColor}`}>{value}</p>
      </div>
    </Link>
  );
}
