import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { assetApi, assetCategoryApi, propertyApi, floorApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { cls } from "../lib/styles";
import { ActiveBadge, ConditionBadge } from "../components/ui/Badge";
import { Pagination, EmptyState, TableLoading } from "../components/ui/DataTable";
import PageHeader from "../components/ui/PageHeader";
import Modal from "../components/ui/Modal";
import { Search, Eye, Package, Plus, X, Download, Power, PowerOff } from "lucide-react";

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

interface SelectOption {
  id: string;
  name: string;
}

interface Floor {
  id: string;
  name: string;
  status: string;
}

export default function AssetsListPage() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    total: 0,
    totalPages: 0,
    page: 1,
    limit: 10,
  });

  // Dropdown data
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [properties, setProperties] = useState<SelectOption[]>([]);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    propertyId: "",
    floorId: "",
    name: "",
    categoryId: "",
    condition: "GOOD",
    serialNumber: "",
    purchaseDate: "",
  });
  const [createImage, setCreateImage] = useState<File | null>(null);
  const [modalFloors, setModalFloors] = useState<Floor[]>([]);
  const [floorsLoading, setFloorsLoading] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Fetch filter dropdown data on mount
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [catRes, propRes] = await Promise.all([
          assetCategoryApi.list(),
          propertyApi.list({ limit: 500 }),
        ]);
        setCategories(catRes.data.data || []);
        const propData = propRes.data.data;
        setProperties(Array.isArray(propData) ? propData : propData.data || []);
      } catch {
        // Silently fail - filters just won't be populated
      }
    };
    loadFilterData();
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (conditionFilter) params.condition = conditionFilter;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (propertyFilter) params.propertyId = propertyFilter;

      const res = await assetApi.listAll(params);
      setAssets(res.data.data.data);
      setPagination(res.data.data.pagination);
    } catch {
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, conditionFilter, categoryFilter, propertyFilter]);

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

  // Clear selection when page or filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, search, statusFilter, conditionFilter, categoryFilter, propertyFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatus = async (action: "activate" | "deactivate") => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await assetApi.bulkStatus(Array.from(selectedIds), action);
      toast.success(`${selectedIds.size} asset${selectedIds.size > 1 ? "s" : ""} ${action}d`);
      setSelectedIds(new Set());
      fetchAssets();
    } catch {
      toast.error(`Failed to ${action} assets`);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportSelected = () => {
    const selected = assets.filter((a) => selectedIds.has(a.id));
    const header = "Code,Name,Category,Property,Condition,Status";
    const rows = selected.map((a) =>
      [a.code, `"${a.name}"`, a.category.name, a.property.name, a.condition, a.status].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `assets-export-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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

  // Fetch floors when property changes in the create modal
  useEffect(() => {
    if (!createForm.propertyId) {
      setModalFloors([]);
      return;
    }
    const loadFloors = async () => {
      setFloorsLoading(true);
      try {
        const res = await floorApi.list(createForm.propertyId);
        const floors: Floor[] = res.data.data || [];
        setModalFloors(floors.filter((f) => f.status === "ACTIVE"));
      } catch {
        setModalFloors([]);
      } finally {
        setFloorsLoading(false);
      }
    };
    loadFloors();
  }, [createForm.propertyId]);

  const handleCreateFormChange = (field: string, value: string) => {
    setCreateForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset floor when property changes
      if (field === "propertyId") next.floorId = "";
      return next;
    });
  };

  const handleCreateSubmit = async () => {
    if (!createForm.propertyId || !createForm.floorId || !createForm.name || !createForm.categoryId) {
      toast.error("Property, floor, name, and category are required");
      return;
    }

    setCreateLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", createForm.name);
      fd.append("categoryId", createForm.categoryId);
      fd.append("floorId", createForm.floorId);
      fd.append("condition", createForm.condition);
      if (createForm.serialNumber) fd.append("serialNumber", createForm.serialNumber);
      if (createForm.purchaseDate) fd.append("purchaseDate", createForm.purchaseDate);
      if (createImage) fd.append("image", createImage);

      await assetApi.create(createForm.propertyId, fd);
      toast.success("Asset created");
      setShowCreateModal(false);
      setCreateForm({ propertyId: "", floorId: "", name: "", categoryId: "", condition: "GOOD", serialNumber: "", purchaseDate: "" });
      setCreateImage(null);
      fetchAssets();
    } catch {
      toast.error("Failed to create asset");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="All Assets"
        subtitle="View all assets across all properties."
        actions={
          hasPermission(PERMISSIONS.ASSETS.CREATE) && (
            <button className={cls.btnPrimary} onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> New Asset
            </button>
          )
        }
      />

      {/* Filters */}
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
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
        <select
          value={conditionFilter}
          onChange={(e) => { setConditionFilter(e.target.value); setPage(1); }}
          className={cls.select}
        >
          <option value="">All Conditions</option>
          <option value="EXCELLENT">Excellent</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="POOR">Poor</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className={cls.select}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={propertyFilter}
          onChange={(e) => { setPropertyFilter(e.target.value); setPage(1); }}
          className={cls.select}
        >
          <option value="">All Properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white ring-1 ring-gray-200">
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className={cls.th}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    checked={assets.length > 0 && selectedIds.size === assets.length}
                    onChange={toggleSelectAll}
                  />
                </th>
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
                  <td colSpan={9}><TableLoading /></td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={9}>
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
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        checked={selectedIds.has(asset.id)}
                        onChange={() => toggleSelectOne(asset.id)}
                      />
                    </td>
                    <td className={`px-3 py-2 ${cls.mono}`}>
                      <Link to={`/assets/${asset.code}`} className={cls.link}>
                        {asset.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium">
                      <Link to={`/assets/${asset.code}`} className={cls.link}>
                        {asset.name}
                      </Link>
                    </td>
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

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 animate-slide-up rounded-lg bg-white px-4 py-2.5 shadow-lg ring-1 ring-gray-200">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-medium text-gray-700">
              {selectedIds.size} selected
            </span>
            <div className="h-4 w-px bg-gray-200" />
            {hasPermission(PERMISSIONS.ASSETS.DEACTIVATE) && (
              <>
                <button
                  onClick={() => handleBulkStatus("activate")}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <Power size={14} /> Activate
                </button>
                <button
                  onClick={() => handleBulkStatus("deactivate")}
                  disabled={bulkLoading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  <PowerOff size={14} /> Deactivate
                </button>
              </>
            )}
            <button
              onClick={handleExportSelected}
              className={cls.btnSecondary}
            >
              <Download size={14} /> Export Selected
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className={cls.btnGhost}
            >
              <X size={14} /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Create Asset Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Asset" size="md">
        <div className="space-y-3">
          {/* Property */}
          <div>
            <label className={cls.label}>Property <span className="text-red-500">*</span></label>
            <select
              value={createForm.propertyId}
              onChange={(e) => handleCreateFormChange("propertyId", e.target.value)}
              className={`${cls.select} w-full`}
            >
              <option value="">Select property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Floor */}
          <div>
            <label className={cls.label}>Floor <span className="text-red-500">*</span></label>
            <select
              value={createForm.floorId}
              onChange={(e) => handleCreateFormChange("floorId", e.target.value)}
              className={`${cls.select} w-full`}
              disabled={!createForm.propertyId || floorsLoading}
            >
              <option value="">
                {!createForm.propertyId
                  ? "Select a property first"
                  : floorsLoading
                    ? "Loading floors..."
                    : "Select floor..."}
              </option>
              {modalFloors.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className={cls.label}>Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => handleCreateFormChange("name", e.target.value)}
              className={cls.input}
              placeholder="e.g. Split AC Unit"
            />
          </div>

          {/* Category */}
          <div>
            <label className={cls.label}>Category <span className="text-red-500">*</span></label>
            <select
              value={createForm.categoryId}
              onChange={(e) => handleCreateFormChange("categoryId", e.target.value)}
              className={`${cls.select} w-full`}
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className={cls.label}>Condition</label>
            <select
              value={createForm.condition}
              onChange={(e) => handleCreateFormChange("condition", e.target.value)}
              className={`${cls.select} w-full`}
            >
              <option value="EXCELLENT">Excellent</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select>
          </div>

          {/* Serial Number */}
          <div>
            <label className={cls.label}>Serial Number</label>
            <input
              type="text"
              value={createForm.serialNumber}
              onChange={(e) => handleCreateFormChange("serialNumber", e.target.value)}
              className={cls.input}
              placeholder="Optional"
            />
          </div>

          {/* Purchase Date */}
          <div>
            <label className={cls.label}>Purchase Date</label>
            <input
              type="date"
              value={createForm.purchaseDate}
              onChange={(e) => handleCreateFormChange("purchaseDate", e.target.value)}
              className={cls.input}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Image */}
          <div>
            <label className={cls.label}>Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCreateImage(e.target.files?.[0] || null)}
              className="block w-full text-[13px] text-gray-500 file:mr-2 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => setShowCreateModal(false)}
              className={cls.btnSecondary}
              disabled={createLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSubmit}
              className={cls.btnPrimary}
              disabled={createLoading}
            >
              {createLoading ? "Creating..." : "Create Asset"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
