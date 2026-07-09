import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { unitApi, propertyApi, floorApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { Search, Layers, X } from "lucide-react";
import { cls } from "../lib/styles";
import { ActiveBadge } from "../components/ui/Badge";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";

interface Unit {
  id: string;
  code: string;
  name: string;
  unitType: string | null;
  status: string;
  floor: { id: string; name: string } | null;
  property: { id: string; name: string; code: string };
}

export default function UnitListPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState(searchParams.get("propertyId") || "");
  const [floorFilter, setFloorFilter] = useState(searchParams.get("floorId") || "");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [floors, setFloors] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: 10,
  });

  // Load property list once for the filter dropdown.
  useEffect(() => {
    propertyApi
      .list({ limit: 200 })
      .then((r) => setProperties(r.data.data.data || r.data.data || []))
      .catch(() => {});
  }, []);

  // Load floors for the picked property (or clear when property clears).
  useEffect(() => {
    if (!propertyFilter) {
      setFloors([]);
      return;
    }
    floorApi
      .list(propertyFilter)
      .then((r) => setFloors(r.data.data || []))
      .catch(() => setFloors([]));
  }, [propertyFilter]);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (propertyFilter) params.propertyId = propertyFilter;
      if (floorFilter) params.floorId = floorFilter;

      const res = await unitApi.listAll(params);
      setUnits(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load units");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, propertyFilter, floorFilter]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Reflect the property/floor filters in the URL so links from other
  // pages (e.g. clicking a floor name elsewhere) can deep-link here.
  useEffect(() => {
    const params: Record<string, string> = {};
    if (propertyFilter) params.propertyId = propertyFilter;
    if (floorFilter) params.floorId = floorFilter;
    setSearchParams(params, { replace: true });
  }, [propertyFilter, floorFilter, setSearchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setPropertyFilter("");
    setFloorFilter("");
    setPage(1);
  };
  const hasActiveFilters = !!(search || statusFilter || propertyFilter || floorFilter);

  return (
    <div>
      <PageHeader
        title="All Units"
        subtitle="View all units across all properties."
      />

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search name or code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${cls.input} pl-8`}
          />
        </div>
        <select
          value={propertyFilter}
          onChange={(e) => {
            setPropertyFilter(e.target.value);
            setFloorFilter("");
            setPage(1);
          }}
          className={cls.select}
        >
          <option value="">All Properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={floorFilter}
          onChange={(e) => {
            setFloorFilter(e.target.value);
            setPage(1);
          }}
          disabled={!propertyFilter}
          className={`${cls.select} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
        >
          <option value="">{propertyFilter ? "All Floors" : "Pick a property first"}</option>
          {floors.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={cls.select}
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
      {hasActiveFilters && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[11px] text-gray-500">
            {pagination.total} match{pagination.total === 1 ? "" : "es"}
          </span>
          <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-200">
            Clear filters <X size={10} />
          </button>
        </div>
      )}

      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>Code</th>
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Type</th>
                <th className={cls.th}>Floor</th>
                <th className={cls.th}>Property</th>
                <th className={cls.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <TableLoading />
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<Layers size={40} />}
                      title="No units found"
                      subtitle="Try adjusting your search or filters."
                    />
                  </td>
                </tr>
              ) : (
                units.map((unit) => (
                  <tr key={unit.id} className={cls.tr}>
                    <td className={`${cls.td} ${cls.mono}`}>{unit.code}</td>
                    <td className={`${cls.td} font-medium`}>{unit.name}</td>
                    <td className={`${cls.td} text-gray-600`}>
                      {unit.unitType || "\u2014"}
                    </td>
                    <td className={cls.td}>
                      {(() => {
                        const floor = unit.floor;
                        if (!floor) return <span className="text-gray-600">{"\u2014"}</span>;
                        return (
                          <button
                            onClick={() => {
                              // Clicking a floor cell filters the list to
                              // that floor \u2014 cheap in-place hyperlink.
                              setPropertyFilter(unit.property.id);
                              setFloorFilter(floor.id);
                              setPage(1);
                            }}
                            className={cls.link}
                          >
                            {floor.name}
                          </button>
                        );
                      })()}
                    </td>
                    <td className={cls.td}>
                      <Link to={`/properties/${unit.property.id}`} className={cls.link}>
                        {unit.property.name}
                      </Link>
                      <span className="ml-1 text-[11px] text-gray-400">
                        ({unit.property.code})
                      </span>
                    </td>
                    <td className={cls.td}>
                      <ActiveBadge status={unit.status} />
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
