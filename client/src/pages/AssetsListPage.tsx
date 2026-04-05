import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { assetApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { cls } from "../lib/styles";
import { ActiveBadge, ConditionBadge } from "../components/ui/Badge";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import { Search, Eye, Package } from "lucide-react";

interface Asset {
  id: string;
  code: string;
  name: string;
  condition: string;
  status: string;
  unit: { id: string; name: string; code: string };
  category: { id: string; name: string };
  property: { id: string; name: string; code: string };
}

export default function AssetsListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: 10,
  });

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await assetApi.listAll(params);
      setAssets(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const handleToggleStatus = async (asset: Asset) => {
    try {
      if (asset.status === "ACTIVE") {
        await assetApi.deactivate(asset.id);
        toast.success("Asset deactivated");
      } else {
        await assetApi.activate(asset.id);
        toast.success("Asset activated");
      }
      fetchAssets();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div>
      <PageHeader
        title="All Assets"
        subtitle="View all assets across all properties."
      />

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${cls.input} pl-8`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className={cls.select}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>Code</th>
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Category</th>
                <th className={cls.th}>Property</th>
                <th className={cls.th}>Unit</th>
                <th className={cls.th}>Condition</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}><TableLoading /></td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<Package size={48} />}
                      title="No assets found"
                      subtitle="Try adjusting your search or filters."
                    />
                  </td>
                </tr>
              ) : (
                assets.map((asset) => (
                  <tr key={asset.id} className={cls.tr}>
                    <td className={`px-3 py-2 ${cls.mono}`}>{asset.code}</td>
                    <td className="px-3 py-2 font-medium">{asset.name}</td>
                    <td className="px-3 py-2 text-gray-600">{asset.category.name}</td>
                    <td className="px-3 py-2">
                      <Link to={`/properties/${asset.property.id}`} className={cls.link}>
                        {asset.property.name}
                      </Link>
                      <span className="ml-1 text-xs text-gray-400">({asset.property.code})</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {asset.unit?.name || "\u2014"}
                      {asset.unit?.code && (
                        <span className="ml-1 text-xs text-gray-400">({asset.unit.code})</span>
                      )}
                    </td>
                    <td className="px-3 py-2"><ConditionBadge condition={asset.condition} /></td>
                    <td className="px-3 py-2"><ActiveBadge status={asset.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Link to={`/assets/${asset.code}`} className={cls.btnIcon} title="View Details">
                          <Eye size={15} />
                        </Link>
                        {hasPermission(PERMISSIONS.ASSETS.DEACTIVATE) && (
                          <button
                            onClick={() => handleToggleStatus(asset)}
                            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                              asset.status === "ACTIVE"
                                ? "text-red-600 hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {asset.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination pagination={pagination} onPageChange={setPage} />
      </div>
    </div>
  );
}
