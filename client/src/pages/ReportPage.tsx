import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { userApi, departmentApi, propertyApi, assetApi } from "../lib/api";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { TableLoading } from "../components/ui/DataTable";
import { Users, Building2, LayoutGrid, Package, Search, ChevronRight } from "lucide-react";

// Minimum chars before fetching for large collections
const MIN_SEARCH_CHARS: Record<string, number> = { asset: 2, user: 0, property: 0, department: 0 };

type EntityType = "user" | "department" | "property" | "asset";

interface Option { id: string; label: string; sub?: string; }

const ENTITY_CONFIG = {
  user: {
    label: "User",
    description: "View all ticket activity for a specific person",
    icon: Users,
    color: "bg-blue-50 text-blue-600 ring-blue-100",
    activeColor: "ring-2 ring-blue-500 bg-blue-50",
  },
  department: {
    label: "Department",
    description: "See how a department is handling tickets",
    icon: LayoutGrid,
    color: "bg-purple-50 text-purple-600 ring-purple-100",
    activeColor: "ring-2 ring-purple-500 bg-purple-50",
  },
  property: {
    label: "Property",
    description: "Full ticket and asset report for a property",
    icon: Building2,
    color: "bg-green-50 text-green-600 ring-green-100",
    activeColor: "ring-2 ring-green-500 bg-green-50",
  },
  asset: {
    label: "Asset",
    description: "History of all tickets linked to an asset",
    icon: Package,
    color: "bg-orange-50 text-orange-600 ring-orange-100",
    activeColor: "ring-2 ring-orange-500 bg-orange-50",
  },
} as const;

export default function ReportPage() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doFetch = useCallback((type: EntityType, q: string) => {
    const minChars = MIN_SEARCH_CHARS[type] ?? 0;
    if (q.length < minChars) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDropdownOpen(true);

    const fetchers: Record<EntityType, () => Promise<Option[]>> = {
      user: async () => {
        const res = await userApi.list({ search: q, limit: 30 });
        const items = res.data.data?.data ?? res.data.data ?? [];
        return items.map((u: any) => ({ id: u.id, label: u.fullName || u.username, sub: u.role?.name }));
      },
      department: async () => {
        const res = await departmentApi.list();
        const items: any[] = res.data.data ?? [];
        return items
          .filter((d: any) => !q || d.name.toLowerCase().includes(q.toLowerCase()))
          .map((d: any) => ({ id: d.id, label: d.name }));
      },
      property: async () => {
        const res = await propertyApi.list({ search: q, limit: 30 });
        const items = res.data.data?.data ?? res.data.data ?? [];
        return items.map((p: any) => ({ id: p.id, label: p.name, sub: p.city }));
      },
      asset: async () => {
        const res = await assetApi.listAll({ search: q, limit: 30 });
        const items = res.data.data?.data ?? res.data.data ?? [];
        return items.map((a: any) => ({ id: a.id, label: a.name, sub: a.code }));
      },
    };

    fetchers[type]()
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounced fetch on search change
  useEffect(() => {
    if (!selectedType) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(selectedType, search.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [selectedType, search, doFetch]);

  const handleSelect = (option: Option) => {
    navigate(`/reports/${selectedType}/${option.id}`);
  };

  const handleTypeSelect = (type: EntityType) => {
    setSelectedType(type);
    setSearch("");
    setOptions([]);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Reports"
        subtitle="Select an entity to generate a full report automatically."
      />

      {/* Entity type cards */}
      <div className="grid grid-cols-2 gap-3 mb-3 sm:grid-cols-4">
        {(Object.keys(ENTITY_CONFIG) as EntityType[]).map((type) => {
          const cfg = ENTITY_CONFIG[type];
          const Icon = cfg.icon;
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className={`flex flex-col items-start gap-2 rounded-lg p-3 text-left ring-1 transition-all ${
                isSelected ? cfg.activeColor : "bg-white ring-gray-200 hover:ring-gray-300"
              }`}
            >
              <div className={`rounded-lg p-2 ring-1 ${cfg.color}`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">{cfg.label}</p>
                <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{cfg.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + dropdown */}
      {selectedType && (
        <div className="relative" ref={dropdownRef}>
          <p className={cls.label}>
            Search {ENTITY_CONFIG[selectedType].label}
          </p>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => { setDropdownOpen(true); if (!search.trim()) doFetch(selectedType, ""); }}
              placeholder={selectedType === "asset" ? "Type asset name or code..." : `Search ${ENTITY_CONFIG[selectedType].label.toLowerCase()}...`}
              className={`${cls.input} pl-9`}
            />
          </div>

          {dropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg bg-white ring-1 ring-gray-200 shadow-lg overflow-hidden">
              {loading ? (
                <TableLoading />
              ) : search.trim().length < (MIN_SEARCH_CHARS[selectedType] ?? 0) ? (
                <div className="py-8 text-center text-[13px] text-gray-400">
                  Type at least {MIN_SEARCH_CHARS[selectedType]} characters to search
                </div>
              ) : options.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-gray-400">No results</div>
              ) : (
                <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                  {options.map((opt) => (
                    <li key={opt.id}>
                      <button
                        onClick={() => handleSelect(opt)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="text-[13px] font-medium text-gray-900">{opt.label}</p>
                          {opt.sub && <p className="text-[11px] text-gray-500">{opt.sub}</p>}
                        </div>
                        <ChevronRight size={14} className="text-gray-300" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
