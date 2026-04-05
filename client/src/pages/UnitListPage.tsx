import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { unitApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { Search, Layers } from "lucide-react";
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
  const [units, setUnits] = useState<Unit[]>([]);
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

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;

      const res = await unitApi.listAll(params);
      setUnits(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load units");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  return (
    <div>
      <PageHeader
        title="All Units"
        subtitle="View all units across all properties."
      />

      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
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
                    <td className={`${cls.td} text-gray-600`}>
                      {unit.floor?.name || "\u2014"}
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
