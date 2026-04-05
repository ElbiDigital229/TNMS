import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { propertyApi, areaGroupApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { cls } from "../lib/styles";
import { ActiveBadge } from "../components/ui/Badge";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import { Plus, Search, Eye, Pencil, Building2, Download } from "lucide-react";
import { CITY_LABELS, PROPERTY_TYPE_LABELS } from "../../../shared/types";

interface Property {
  id: string;
  name: string;
  code: string;
  type: string;
  city: string;
  status: string;
  imagePath: string | null;
  areaGroup: { groupName: string } | null;
}

interface AreaGroup {
  id: string;
  city: string;
  groupName: string;
}

export default function PropertyListPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.PROPERTIES.EDIT);
  const canDeactivate = hasPermission(PERMISSIONS.PROPERTIES.DEACTIVATE);
  const canCreate = hasPermission(PERMISSIONS.PROPERTIES.CREATE);
  const canExport = hasPermission(PERMISSIONS.PROPERTIES.EXPORT);
  const [properties, setProperties] = useState<Property[]>([]);
  const [areaGroups, setAreaGroups] = useState<AreaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: 10,
  });

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      if (cityFilter) params.city = cityFilter;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (groupFilter) params.areaGroupId = groupFilter;

      const res = await propertyApi.list(params);
      setProperties(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, [page, search, cityFilter, typeFilter, statusFilter, groupFilter]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    areaGroupApi.list().then((res) => setAreaGroups(res.data.data));
  }, []);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (cityFilter) params.city = cityFilter;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (groupFilter) params.areaGroupId = groupFilter;

      const res = await propertyApi.exportCsv(params);
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `properties_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export properties");
    }
  };

  const handleToggleStatus = async (property: Property) => {
    try {
      if (property.status === "ACTIVE") {
        await propertyApi.deactivate(property.id);
        toast.success("Property deactivated");
      } else {
        await propertyApi.activate(property.id);
        toast.success("Property activated");
      }
      fetchProperties();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle={`${pagination.total} ${pagination.total === 1 ? "property" : "properties"} total`}
        actions={
          <>
            {canExport && (
              <button onClick={handleExport} className={cls.btnSecondary}>
                <Download size={14} />
                Export
              </button>
            )}
            {canCreate && (
              <Link to="/properties/new" className={cls.btnPrimary}>
                <Plus size={14} />
                Add Property
              </Link>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name or code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${cls.input} pl-8`}
          />
        </div>
        <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Cities</option>
          <option value="LAHORE">Lahore</option>
          <option value="ISLAMABAD">Islamabad</option>
        </select>
        <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Types</option>
          <option value="FLOOR">Floor</option>
          <option value="BUILDING">Building</option>
          <option value="COMPOUND">Compound</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }} className={cls.select}>
          <option value="">All Groups</option>
          {areaGroups.map((g) => (
            <option key={g.id} value={g.id}>{g.groupName}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>Image</th>
                <th className={cls.th}>Code</th>
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Type</th>
                <th className={cls.th}>City</th>
                <th className={cls.th}>Area Group</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}><TableLoading /></td>
                </tr>
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon={<Building2 size={48} />}
                      title="No properties found"
                      subtitle="Try adjusting your search or filters"
                    />
                  </td>
                </tr>
              ) : (
                properties.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className={cls.trClick}
                  >
                    <td className="px-3 py-2">
                      {p.imagePath ? (
                        <img src={`/${p.imagePath}`} alt={p.name} className="h-8 w-8 rounded-md object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 text-gray-400">
                          <Eye size={14} />
                        </div>
                      )}
                    </td>
                    <td className={`px-3 py-2 ${cls.mono}`}>{p.code}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-gray-600">{PROPERTY_TYPE_LABELS[p.type] || p.type}</td>
                    <td className="px-3 py-2 text-gray-600">{CITY_LABELS[p.city] || p.city}</td>
                    <td className="px-3 py-2 text-gray-600">{p.areaGroup?.groupName || "\u2014"}</td>
                    <td className="px-3 py-2"><ActiveBadge status={p.status} /></td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Link to={`/properties/${p.id}`} className={cls.btnIcon} title="View">
                          <Eye size={15} />
                        </Link>
                        {canEdit && (
                          <Link to={`/properties/${p.id}/edit`} className={cls.btnIcon} title="Edit">
                            <Pencil size={15} />
                          </Link>
                        )}
                        {canDeactivate && (
                          <button
                            onClick={() => handleToggleStatus(p)}
                            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                              p.status === "ACTIVE"
                                ? "text-red-600 hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                          >
                            {p.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
