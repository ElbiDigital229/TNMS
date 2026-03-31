import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { propertyApi, areaGroupApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import {
  CITY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "../../../shared/types";

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
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Properties</h1>
          <p className="mt-1 text-[13px] text-gray-500">
            {pagination.total} {pagination.total === 1 ? "property" : "properties"} total
          </p>
        </div>
        {canCreate && (
        <Link
          to="/properties/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
        >
          <Plus size={18} />
          Add Property
        </Link>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search name or code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
          />
        </div>

        <select
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
        >
          <option value="">All Cities</option>
          <option value="LAHORE">Lahore</option>
          <option value="ISLAMABAD">Islamabad</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
        >
          <option value="">All Types</option>
          <option value="FLOOR">Floor</option>
          <option value="BUILDING">Building</option>
          <option value="COMPOUND">Compound</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <select
          value={groupFilter}
          onChange={(e) => {
            setGroupFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
        >
          <option value="">All Groups</option>
          {areaGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.groupName}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Image
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Code
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Type
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  City
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Area Group
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 size={64} className="text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">No properties found</p>
                      <p className="text-[13px] text-gray-400">Try adjusting your search or filters</p>
                    </div>
                  </td>
                </tr>
              ) : (
                properties.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className="cursor-pointer border-b border-gray-100/80 transition-colors duration-150 hover:bg-gray-50/80"
                  >
                    <td className="px-5 py-3.5">
                      {p.imagePath ? (
                        <img
                          src={`/${p.imagePath}`}
                          alt={p.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
                          <Eye size={16} />
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-primary-600">
                      {p.code}
                    </td>
                    <td className="px-5 py-3.5 font-medium">{p.name}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {PROPERTY_TYPE_LABELS[p.type] || p.type}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {CITY_LABELS[p.city] || p.city}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {p.areaGroup?.groupName || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "ACTIVE"
                            ? "bg-green-50 text-green-600 ring-1 ring-green-600/10"
                            : "bg-red-50 text-red-600 ring-1 ring-red-600/10"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/properties/${p.id}`}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="View"
                        >
                          <Eye size={16} />
                        </Link>
                        {canEdit && (
                        <Link
                          to={`/properties/${p.id}/edit`}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </Link>
                        )}
                        {canDeactivate && (
                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <span className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
              {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-medium">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page === pagination.totalPages}
                className="rounded-lg border border-gray-200 p-1.5 shadow-sm hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
