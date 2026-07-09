import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ppmApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { cls } from "../lib/styles";
import { ActiveBadge } from "../components/ui/Badge";
import { EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import { Plus, Search, ListChecks, Pencil, X } from "lucide-react";

interface Ppm {
  id: string;
  name: string;
  description: string | null;
  status: string;
  steps: { id: string; text: string; order: number }[];
  _count: { tickets: number };
}

export default function PpmListPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.PPM.MANAGE);

  const [ppms, setPpms] = useState<Ppm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchInput) params.search = searchInput;
      if (statusFilter) params.status = statusFilter;
      const res = await ppmApi.list(params);
      setPpms(res.data.data);
    } catch {
      toast.error("Failed to load PPMs");
    } finally {
      setLoading(false);
    }
  }, [searchInput, statusFilter]);

  useEffect(() => {
    const t = setTimeout(fetch, 200);
    return () => clearTimeout(t);
  }, [fetch]);

  const toggleStatus = async (ppm: Ppm) => {
    try {
      if (ppm.status === "ACTIVE") await ppmApi.deactivate(ppm.id);
      else await ppmApi.activate(ppm.id);
      toast.success(`PPM ${ppm.status === "ACTIVE" ? "deactivated" : "activated"}`);
      fetch();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div>
      <PageHeader
        title="PPM"
        subtitle="Planned Preventive Maintenance checklists"
        actions={
          canManage && (
            <Link to="/ppm/new" className={cls.btnPrimary}>
              <Plus size={16} /> Create PPM
            </Link>
          )
        }
      />

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${cls.input} pl-8`}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={cls.select}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Description</th>
                <th className={cls.th}>Steps</th>
                <th className={cls.th}>Used by</th>
                <th className={cls.th}>Status</th>
                {canManage && <th className={cls.th}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canManage ? 6 : 5}><TableLoading /></td></tr>
              ) : ppms.length === 0 ? (
                <tr><td colSpan={canManage ? 6 : 5}>
                  <EmptyState
                    icon={<ListChecks size={40} />}
                    title="No PPMs yet"
                    subtitle={canManage ? "Create your first PPM checklist" : "Ask an admin to create a PPM"}
                  />
                </td></tr>
              ) : (
                ppms.map((p) => (
                  <tr key={p.id} className={cls.trClick} onClick={() => canManage && navigate(`/ppm/${p.id}/edit`)}>
                    <td className={`${cls.td} font-medium`}>{p.name}</td>
                    <td className={`${cls.td} text-gray-600`}>{p.description || "—"}</td>
                    <td className={cls.td}>{p.steps.length}</td>
                    <td className={cls.td}>{p._count.tickets} ticket{p._count.tickets === 1 ? "" : "s"}</td>
                    <td className={cls.td}><ActiveBadge status={p.status} /></td>
                    {canManage && (
                      <td className={cls.td}>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Link to={`/ppm/${p.id}/edit`} className={cls.btnIcon} title="Edit"><Pencil size={15} /></Link>
                          <button
                            onClick={() => toggleStatus(p)}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${p.status === "ACTIVE" ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
                          >
                            {p.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
