import { useState, useEffect, useCallback } from "react";
import { auditApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import { Badge } from "../components/ui/Badge";
import { ScrollText, Download, Loader2, X } from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  user: { id: string; fullName?: string; username: string };
  action: string;
  module: string;
  details: string;
}

const MODULES = [
  "properties",
  "tickets",
  "users",
  "roles",
  "assets",
  "floors",
  "units",
  "categories",
  "area-groups",
];

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "STATUS_CHANGE",
  "LOGIN",
  "ASSIGN",
];

const actionColor = (action: string) => {
  switch (action) {
    case "CREATE":
      return "bg-green-50 text-green-600";
    case "UPDATE":
      return "bg-blue-50 text-blue-600";
    case "DELETE":
      return "bg-red-50 text-red-600";
    case "STATUS_CHANGE":
      return "bg-yellow-50 text-yellow-600";
    case "LOGIN":
      return "bg-gray-100 text-gray-700";
    case "ASSIGN":
      return "bg-purple-50 text-purple-600";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const formatTimestamp = (ts: string) => {
  const date = new Date(ts);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const truncate = (text: string, maxLen = 80) => {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
};

export default function AuditLogPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: 10,
  });

  const buildParams = useCallback(() => {
    const params: Record<string, string | number> = { page, limit: 10 };
    if (moduleFilter) params.module = moduleFilter;
    if (actionFilter) params.action = actionFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return params;
  }, [page, moduleFilter, actionFilter, dateFrom, dateTo]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list(buildParams());
      setLogs(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await auditApi.exportLogs(buildParams());
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Audit log exported successfully");
    } catch {
      toast.error("Failed to export audit logs");
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setModuleFilter("");
    setActionFilter("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasFilters = moduleFilter || actionFilter || dateFrom || dateTo;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Track all system activities"
        actions={
          <button
            onClick={handleExport}
            disabled={exporting}
            className={cls.btnPrimary}
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            Export
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <select
          value={moduleFilter}
          onChange={(e) => {
            setModuleFilter(e.target.value);
            setPage(1);
          }}
          className={cls.select}
        >
          <option value="">All Modules</option>
          {MODULES.map((m) => (
            <option key={m} value={m}>
              {m.charAt(0).toUpperCase() + m.slice(1).replace("-", " ")}
            </option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className={cls.select}
        >
          <option value="">All Actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a.replace("_", " ")}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          placeholder="Date From"
          className={cls.input}
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          placeholder="Date To"
          className={cls.input}
        />

        {hasFilters && (
          <button onClick={clearFilters} className={cls.btnSecondary}>
            <X size={14} />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          {loading ? (
            <TableLoading />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<ScrollText size={36} />}
              title="No audit logs found"
              subtitle="System activities will appear here"
            />
          ) : (
            <table className={cls.table}>
              <thead>
                <tr className="border-b border-gray-100">
                  <th className={cls.th}>Timestamp</th>
                  <th className={cls.th}>User</th>
                  <th className={cls.th}>Action</th>
                  <th className={cls.th}>Module</th>
                  <th className={cls.th}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className={cls.tr}>
                    <td className={`${cls.td} whitespace-nowrap text-[11px] text-gray-500`}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className={`${cls.td} font-medium text-gray-900`}>
                      {log.user?.fullName || log.user?.username || "-"}
                    </td>
                    <td className={cls.td}>
                      <Badge color={actionColor(log.action)}>
                        {log.action.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className={`${cls.td} text-gray-600`}>
                      {log.module
                        ? log.module.charAt(0).toUpperCase() +
                          log.module.slice(1).replace("-", " ")
                        : "-"}
                    </td>
                    <td
                      className={`${cls.td} max-w-xs text-[11px] text-gray-500`}
                      title={log.details}
                    >
                      {truncate(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
}
