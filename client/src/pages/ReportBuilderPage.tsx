import { useState, useEffect, useCallback } from "react";
import {
  reportApi,
  propertyApi,
  userApi,
  assetCategoryApi,
  ticketCategoryApi,
} from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { BarChart3, Plus, X, Download, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────
type Entity = "tickets" | "assets" | "properties" | "units";
type Measure = "count" | "avg_completion_time";
type Operator = "eq" | "in" | "between" | "gte" | "lte";

interface ReportFilter {
  id: number;
  field: string;
  operator: Operator;
  value: any;
}

interface ResultRow {
  groupKey: string | null;
  label: string;
  value: number;
}

// ─── Config ──────────────────────────────────────────────

const ENTITY_LABELS: Record<Entity, string> = {
  tickets: "Tickets",
  assets: "Assets",
  properties: "Properties",
  units: "Units",
};

const MEASURE_OPTIONS: Record<Entity, { value: Measure; label: string }[]> = {
  tickets: [
    { value: "count", label: "Count" },
    { value: "avg_completion_time", label: "Avg Completion Time (hours)" },
  ],
  assets: [{ value: "count", label: "Count" }],
  properties: [{ value: "count", label: "Count" }],
  units: [{ value: "count", label: "Count" }],
};

const GROUP_BY_OPTIONS: Record<Entity, { value: string; label: string }[]> = {
  tickets: [
    { value: "assignedTo", label: "Assigned Technician" },
    { value: "createdBy", label: "Created By" },
    { value: "property", label: "Property" },
    { value: "unit", label: "Unit" },
    { value: "category", label: "Category" },
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
  ],
  assets: [
    { value: "property", label: "Property" },
    { value: "category", label: "Category" },
    { value: "condition", label: "Condition" },
    { value: "floor", label: "Floor" },
  ],
  properties: [
    { value: "city", label: "City" },
    { value: "areaGroup", label: "Area Group" },
    { value: "status", label: "Status" },
    { value: "type", label: "Type" },
  ],
  units: [
    { value: "property", label: "Property" },
    { value: "floor", label: "Floor" },
    { value: "type", label: "Type" },
    { value: "status", label: "Status" },
  ],
};

const FILTER_FIELD_OPTIONS: Record<
  Entity,
  { value: string; label: string }[]
> = {
  tickets: [
    { value: "propertyId", label: "Property" },
    { value: "unitId", label: "Unit" },
    { value: "assignedToId", label: "Assigned To" },
    { value: "createdById", label: "Created By" },
    { value: "categoryId", label: "Category" },
    { value: "status", label: "Status" },
    { value: "priority", label: "Priority" },
    { value: "createdAt", label: "Created Date" },
  ],
  assets: [
    { value: "propertyId", label: "Property" },
    { value: "categoryId", label: "Category" },
    { value: "status", label: "Status" },
    { value: "condition", label: "Condition" },
    { value: "purchaseDate", label: "Purchase Date" },
  ],
  properties: [
    { value: "city", label: "City" },
    { value: "areaGroupId", label: "Area Group" },
    { value: "status", label: "Status" },
    { value: "type", label: "Type" },
  ],
  units: [
    { value: "propertyId", label: "Property" },
    { value: "floorId", label: "Floor" },
    { value: "status", label: "Status" },
    { value: "type", label: "Type" },
  ],
};

const OPERATOR_OPTIONS: { value: Operator; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "in", label: "in" },
  { value: "between", label: "between" },
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
];

// Hardcoded dropdown values for enum fields
const ENUM_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "tickets.status": [
    { value: "OPEN", label: "Open" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" },
  ],
  "tickets.priority": [
    { value: "CRITICAL", label: "Critical" },
    { value: "HIGH", label: "High" },
    { value: "MEDIUM", label: "Medium" },
    { value: "LOW", label: "Low" },
  ],
  "assets.status": [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ],
  "assets.condition": [
    { value: "EXCELLENT", label: "Excellent" },
    { value: "GOOD", label: "Good" },
    { value: "FAIR", label: "Fair" },
    { value: "POOR", label: "Poor" },
  ],
  "properties.city": [
    { value: "LAHORE", label: "Lahore" },
    { value: "ISLAMABAD", label: "Islamabad" },
  ],
  "properties.status": [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ],
  "properties.type": [
    { value: "FLOOR", label: "Floor" },
    { value: "BUILDING", label: "Building" },
    { value: "COMPOUND", label: "Compound" },
  ],
  "units.status": [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ],
  "units.type": [
    { value: "APARTMENT", label: "Apartment" },
    { value: "OFFICE", label: "Office" },
    { value: "SHOP", label: "Shop" },
    { value: "WAREHOUSE", label: "Warehouse" },
    { value: "OTHER", label: "Other" },
  ],
};

const DATE_FIELDS = ["createdAt", "purchaseDate"];

// Fields that need API-fetched options
const API_FIELDS = [
  "propertyId",
  "assignedToId",
  "createdById",
  "categoryId",
  "unitId",
  "floorId",
  "areaGroupId",
];

function isEnumField(entity: Entity, field: string): boolean {
  return !!ENUM_OPTIONS[`${entity}.${field}`];
}

function isDateField(field: string): boolean {
  return DATE_FIELDS.includes(field);
}

function isApiField(field: string): boolean {
  return API_FIELDS.includes(field);
}

// ─── Helpers ─────────────────────────────────────────────

let filterIdCounter = 0;

function getOperatorsForField(
  entity: Entity,
  field: string
): { value: Operator; label: string }[] {
  if (isDateField(field)) {
    return [
      { value: "between", label: "between" },
      { value: "gte", label: ">=" },
      { value: "lte", label: "<=" },
    ];
  }
  if (isEnumField(entity, field) || isApiField(field)) {
    return [
      { value: "eq", label: "=" },
      { value: "in", label: "in" },
    ];
  }
  return OPERATOR_OPTIONS;
}

function exportCsv(results: ResultRow[], measure: Measure) {
  const measureLabel =
    measure === "avg_completion_time" ? "Avg Completion Time (hours)" : "Count";
  const bom = "\uFEFF";
  const header = `Group,${measureLabel}`;
  const rows = results.map((r) => {
    const label = `"${r.label.replace(/"/g, '""')}"`;
    return `${label},${r.value}`;
  });
  const csv = bom + [header, ...rows].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ───────────────────────────────────────────

export default function ReportBuilderPage() {
  const toast = useToast();

  // Query builder state
  const [entity, setEntity] = useState<Entity>("tickets");
  const [measure, setMeasure] = useState<Measure>("count");
  const [groupBy, setGroupBy] = useState("");
  const [filters, setFilters] = useState<ReportFilter[]>([]);

  // Results state
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // Cached lookup data for filter dropdowns
  const [properties, setProperties] = useState<
    { id: string; name: string }[]
  >([]);
  const [users, setUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [assetCategories, setAssetCategories] = useState<
    { id: string; name: string }[]
  >([]);
  const [ticketCategories, setTicketCategories] = useState<
    { id: string; name: string }[]
  >([]);

  // Fetch lookup data once on mount
  useEffect(() => {
    propertyApi
      .list({ limit: 500 })
      .then((res) => {
        const data = res.data.data?.data || res.data.data || [];
        setProperties(
          data.map((p: any) => ({ id: p.id, name: p.name }))
        );
      })
      .catch(() => {});

    userApi
      .list({ limit: 500 })
      .then((res) => {
        const data = res.data.data?.data || res.data.data || [];
        setUsers(
          data.map((u: any) => ({
            id: u.id,
            fullName: u.fullName || u.username,
          }))
        );
      })
      .catch(() => {});

    assetCategoryApi
      .list()
      .then((res) => {
        const data = res.data.data || [];
        setAssetCategories(
          data.map((c: any) => ({ id: c.id, name: c.name }))
        );
      })
      .catch(() => {});

    ticketCategoryApi
      .list()
      .then((res) => {
        const data = res.data.data || [];
        setTicketCategories(
          data.map((c: any) => ({ id: c.id, name: c.name }))
        );
      })
      .catch(() => {});
  }, []);

  // Reset groupBy and filters when entity changes
  const handleEntityChange = useCallback((newEntity: Entity) => {
    setEntity(newEntity);
    setMeasure("count");
    setGroupBy("");
    setFilters([]);
    setResults(null);
    setHasRun(false);
  }, []);

  const addFilter = () => {
    const fields = FILTER_FIELD_OPTIONS[entity];
    if (fields.length === 0) return;
    setFilters((prev) => [
      ...prev,
      {
        id: ++filterIdCounter,
        field: fields[0].value,
        operator: "eq",
        value: "",
      },
    ]);
  };

  const updateFilter = (
    id: number,
    updates: Partial<Omit<ReportFilter, "id">>
  ) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFilter = (id: number) => {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFilterFieldChange = (id: number, newField: string) => {
    const operators = getOperatorsForField(entity, newField);
    updateFilter(id, {
      field: newField,
      operator: operators[0].value,
      value: isDateField(newField) ? ["", ""] : "",
    });
  };

  const handleFilterOperatorChange = (id: number, newOp: Operator) => {
    const filter = filters.find((f) => f.id === id);
    if (!filter) return;
    if (newOp === "between" && isDateField(filter.field)) {
      updateFilter(id, { operator: newOp, value: ["", ""] });
    } else if (newOp === "in") {
      updateFilter(id, { operator: newOp, value: [] });
    } else {
      updateFilter(id, { operator: newOp, value: "" });
    }
  };

  // Get API-fetched options for a field
  const getApiOptions = (
    field: string
  ): { id: string; label: string }[] => {
    switch (field) {
      case "propertyId":
        return properties.map((p) => ({ id: p.id, label: p.name }));
      case "assignedToId":
      case "createdById":
        return users.map((u) => ({ id: u.id, label: u.fullName }));
      case "categoryId":
        if (entity === "tickets") {
          return ticketCategories.map((c) => ({ id: c.id, label: c.name }));
        }
        return assetCategories.map((c) => ({ id: c.id, label: c.name }));
      case "areaGroupId":
        // Area groups are fetched via properties page pattern - keeping simple
        return [];
      case "unitId":
      case "floorId":
        // These would ideally need property-scoped fetches; keep as text input for now
        return [];
      default:
        return [];
    }
  };

  const runReport = async () => {
    if (!groupBy) {
      toast.error("Please select a Group By field");
      return;
    }

    setLoading(true);
    setHasRun(true);
    try {
      // Build the query payload
      const queryFilters = filters
        .filter((f) => {
          if (f.operator === "between") {
            return (
              Array.isArray(f.value) && f.value[0] !== "" && f.value[1] !== ""
            );
          }
          if (f.operator === "in") {
            return Array.isArray(f.value) && f.value.length > 0;
          }
          return f.value !== "";
        })
        .map((f) => ({
          field: f.field,
          operator: f.operator,
          value: f.value,
        }));

      const res = await reportApi.runQuery({
        entity,
        measure,
        groupBy,
        filters: queryFilters,
        sortOrder: "desc",
        limit: 50,
      });

      setResults(res.data.data?.data || res.data.data || []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.response?.data?.error || "Failed to run report";
      toast.error(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const maxValue =
    results && results.length > 0
      ? Math.max(...results.map((r) => r.value))
      : 0;

  const measureLabel =
    measure === "avg_completion_time" ? "Avg Completion Time (hours)" : "Count";

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Report Builder
          </h1>
          <p className="mt-1 text-[13px] text-gray-500">
            Build and run custom queries across your data
          </p>
        </div>
      </div>

      {/* Query Builder Card */}
      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Query Builder
        </h2>

        {/* Top row: Entity, Measure, Group By */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Report On */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Report On
            </label>
            <select
              value={entity}
              onChange={(e) => handleEntityChange(e.target.value as Entity)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              {(Object.keys(ENTITY_LABELS) as Entity[]).map((e) => (
                <option key={e} value={e}>
                  {ENTITY_LABELS[e]}
                </option>
              ))}
            </select>
          </div>

          {/* Measure */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Measure
            </label>
            <select
              value={measure}
              onChange={(e) => setMeasure(e.target.value as Measure)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              {MEASURE_OPTIONS[entity].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Group By */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Group By
            </label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select...</option>
              {GROUP_BY_OPTIONS[entity].map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500">
              Filters
            </label>
            <button
              onClick={addFilter}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50"
            >
              <Plus size={14} />
              Add Filter
            </button>
          </div>

          {filters.length === 0 && (
            <p className="text-xs text-gray-400">
              No filters applied. Click "Add Filter" to narrow your results.
            </p>
          )}

          <div className="space-y-2">
            {filters.map((filter) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                entity={entity}
                operators={getOperatorsForField(entity, filter.field)}
                apiOptions={getApiOptions(filter.field)}
                onFieldChange={(field) =>
                  handleFilterFieldChange(filter.id, field)
                }
                onOperatorChange={(op) =>
                  handleFilterOperatorChange(filter.id, op)
                }
                onValueChange={(value) =>
                  updateFilter(filter.id, { value })
                }
                onRemove={() => removeFilter(filter.id)}
              />
            ))}
          </div>
        </div>

        {/* Run Report Button */}
        <button
          onClick={runReport}
          disabled={loading || !groupBy}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <BarChart3 size={16} />
          )}
          Run Report
        </button>
      </div>

      {/* Results */}
      {hasRun && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Results</h2>
            {results && results.length > 0 && (
              <button
                onClick={() => exportCsv(results, measure)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                size={32}
                className="animate-spin text-primary-400"
              />
            </div>
          ) : !results || results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <BarChart3 size={48} className="text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                No data found for this query.
              </p>
              <p className="text-[13px] text-gray-400">
                Try adjusting your filters.
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="mb-6 overflow-hidden rounded-lg ring-1 ring-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        Group
                      </th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                        {measureLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr
                        key={row.groupKey ?? `null-${i}`}
                        className="border-b border-gray-100 last:border-b-0"
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-800">
                          {row.label}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                          {measure === "avg_completion_time"
                            ? row.value.toFixed(1)
                            : row.value.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bar Chart */}
              <div>
                <h3 className="mb-3 text-xs font-medium text-gray-500">
                  Chart
                </h3>
                <div className="space-y-2">
                  {results.map((row, i) => (
                    <div key={row.groupKey ?? `null-${i}`} className="flex items-center gap-3">
                      <span className="w-32 flex-shrink-0 truncate text-right text-xs text-gray-600">
                        {row.label}
                      </span>
                      <div className="flex-1">
                        <div
                          className="h-6 rounded bg-primary-500 transition-all duration-500"
                          style={{
                            width: `${maxValue > 0 ? (row.value / maxValue) * 100 : 0}%`,
                            minWidth: row.value > 0 ? "2px" : "0",
                          }}
                        />
                      </div>
                      <span className="w-16 flex-shrink-0 text-right text-xs tabular-nums font-medium text-gray-700">
                        {measure === "avg_completion_time"
                          ? row.value.toFixed(1)
                          : row.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filter Row Component ────────────────────────────────

interface FilterRowProps {
  filter: ReportFilter;
  entity: Entity;
  operators: { value: Operator; label: string }[];
  apiOptions: { id: string; label: string }[];
  onFieldChange: (field: string) => void;
  onOperatorChange: (op: Operator) => void;
  onValueChange: (value: any) => void;
  onRemove: () => void;
}

function FilterRow({
  filter,
  entity,
  operators,
  apiOptions,
  onFieldChange,
  onOperatorChange,
  onValueChange,
  onRemove,
}: FilterRowProps) {
  const fields = FILTER_FIELD_OPTIONS[entity];
  const enumOpts = ENUM_OPTIONS[`${entity}.${filter.field}`];
  const isDate = isDateField(filter.field);
  const isApi = isApiField(filter.field);
  const isMulti = filter.operator === "in";

  const selectClass =
    "rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100";
  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100";

  // Render value input based on field type
  const renderValueInput = () => {
    // Date fields
    if (isDate) {
      if (filter.operator === "between") {
        return (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={Array.isArray(filter.value) ? filter.value[0] || "" : ""}
              onChange={(e) =>
                onValueChange([
                  e.target.value,
                  Array.isArray(filter.value) ? filter.value[1] || "" : "",
                ])
              }
              className={inputClass}
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={Array.isArray(filter.value) ? filter.value[1] || "" : ""}
              onChange={(e) =>
                onValueChange([
                  Array.isArray(filter.value) ? filter.value[0] || "" : "",
                  e.target.value,
                ])
              }
              className={inputClass}
            />
          </div>
        );
      }
      return (
        <input
          type="date"
          value={filter.value || ""}
          onChange={(e) => onValueChange(e.target.value)}
          className={inputClass}
        />
      );
    }

    // Enum fields
    if (enumOpts) {
      if (isMulti) {
        const selected: string[] = Array.isArray(filter.value)
          ? filter.value
          : [];
        return (
          <div className="flex flex-wrap gap-1">
            {enumOpts.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onValueChange(selected.filter((v) => v !== opt.value));
                    } else {
                      onValueChange([...selected, opt.value]);
                    }
                  }}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    isSelected
                      ? "bg-primary-100 text-primary-700 ring-1 ring-primary-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }
      return (
        <select
          value={filter.value || ""}
          onChange={(e) => onValueChange(e.target.value)}
          className={`w-full ${selectClass}`}
        >
          <option value="">Select...</option>
          {enumOpts.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    // API-fetched fields
    if (isApi && apiOptions.length > 0) {
      if (isMulti) {
        const selected: string[] = Array.isArray(filter.value)
          ? filter.value
          : [];
        return (
          <div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value && !selected.includes(e.target.value)) {
                  onValueChange([...selected, e.target.value]);
                }
              }}
              className={`w-full ${selectClass}`}
            >
              <option value="">Add item...</option>
              {apiOptions
                .filter((o) => !selected.includes(o.id))
                .map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
            </select>
            {selected.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selected.map((id) => {
                  const opt = apiOptions.find((o) => o.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                    >
                      {opt?.label || id}
                      <button
                        type="button"
                        onClick={() =>
                          onValueChange(selected.filter((v) => v !== id))
                        }
                        className="text-primary-400 hover:text-primary-600"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      }
      return (
        <select
          value={filter.value || ""}
          onChange={(e) => onValueChange(e.target.value)}
          className={`w-full ${selectClass}`}
        >
          <option value="">Select...</option>
          {apiOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    // Fallback: text input
    return (
      <input
        type="text"
        value={filter.value || ""}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Enter value..."
        className={inputClass}
      />
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3 sm:flex-row sm:items-start">
      {/* Field */}
      <select
        value={filter.field}
        onChange={(e) => onFieldChange(e.target.value)}
        className={`sm:w-40 ${selectClass}`}
      >
        {fields.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={filter.operator}
        onChange={(e) => onOperatorChange(e.target.value as Operator)}
        className={`sm:w-24 ${selectClass}`}
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {/* Value */}
      <div className="min-w-0 flex-1">{renderValueInput()}</div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="self-start rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
        title="Remove filter"
      >
        <X size={16} />
      </button>
    </div>
  );
}
