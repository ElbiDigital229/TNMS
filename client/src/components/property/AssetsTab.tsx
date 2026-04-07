import { useState, useEffect } from "react";
import { assetApi, floorApi, assetCategoryApi, assetUrl } from "../../lib/api";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import BulkImportModal from "../ui/BulkImportModal";
import { cls } from "../../lib/styles";
import { ConditionBadge, ActiveBadge } from "../ui/Badge";
import { TableLoading, EmptyState } from "../ui/DataTable";
import { Plus, Eye, Pencil, Package, Upload, Download, Trash2 } from "lucide-react";
import { CONDITION_LABELS } from "../../../../shared/types";
import { useAuth } from "../../contexts/AuthContext";
import { PERMISSIONS } from "../../../../shared/permissions";

interface Asset {
  id: string;
  code: string;
  name: string;
  condition: string;
  status: string;
  unitOfMeasure: string;
  quantity: number;
  additionalInfo?: string;
  serialNumber?: string;
  purchaseDate?: string;
  imagePath?: string;
  floor: { id: string; name: string };
  category: { id: string; name: string };
}

interface Floor {
  id: string;
  name: string;
  status: string;
}

interface Category {
  id: string;
  name: string;
  status: string;
}

interface AssetsTabProps {
  propertyId: string;
  propertyName: string;
  onUpdate: () => void;
}

export default function AssetsTab({
  propertyId,
  propertyName,
  onUpdate,
}: AssetsTabProps) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const P = PERMISSIONS;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [condition, setCondition] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [floorId, setFloorId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [image, setImage] = useState<File | null>(null);

  const fetchData = () => {
    Promise.all([
      assetApi.listByProperty(propertyId),
      floorApi.list(propertyId),
      assetCategoryApi.list(),
    ])
      .then(([assetsRes, floorsRes, catsRes]) => {
        setAssets(assetsRes.data.data);
        setFloors(floorsRes.data.data.filter((f: Floor) => f.status === "ACTIVE"));
        setCategories(catsRes.data.data.filter((c: Category) => c.status === "ACTIVE"));
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} asset${count > 1 ? "s" : ""}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      await assetApi.bulkDelete(propertyId, Array.from(selectedIds));
      toast.success(`${count} asset${count > 1 ? "s" : ""} deleted`);
      setSelectedIds(new Set());
      fetchData();
      onUpdate();
    } catch {
      toast.error("Failed to delete assets");
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setCategoryId("");
    setUnitOfMeasure("");
    setQuantity("1");
    setCondition("");
    setAdditionalInfo("");
    setFloorId("");
    setSerialNumber("");
    setPurchaseDate("");
    setImage(null);
    setEditingAsset(null);
  };

  const openAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = async (asset: Asset) => {
    try {
      const res = await assetApi.getById(asset.id);
      const full = res.data.data;
      setEditingAsset(full);
      setName(full.name);
      setCategoryId(full.categoryId || full.category?.id || "");
      setUnitOfMeasure(full.unitOfMeasure);
      setQuantity(String(full.quantity || 1));
      setCondition(full.condition);
      setAdditionalInfo(full.additionalInfo || "");
      setFloorId(full.floorId || full.floor?.id || "");
      setSerialNumber(full.serialNumber || "");
      setPurchaseDate(
        full.purchaseDate
          ? new Date(full.purchaseDate).toISOString().split("T")[0]
          : ""
      );
      setImage(null);
      setModalOpen(true);
    } catch {
      toast.error("Failed to load asset for editing");
    }
  };

  const handleSave = async () => {
    if (!name || !categoryId || !floorId) {
      toast.error("Name, category, and floor are required");
      return;
    }

    if (purchaseDate && new Date(purchaseDate) > new Date()) {
      toast.error("Purchase date cannot be in the future");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("categoryId", categoryId);
    if (unitOfMeasure) formData.append("unitOfMeasure", unitOfMeasure);
    if (quantity) formData.append("quantity", quantity);
    if (condition) formData.append("condition", condition);
    if (additionalInfo) formData.append("additionalInfo", additionalInfo);
    formData.append("floorId", floorId);
    if (serialNumber) formData.append("serialNumber", serialNumber);
    if (purchaseDate) formData.append("purchaseDate", purchaseDate);
    if (image) formData.append("image", image);

    try {
      if (editingAsset) {
        await assetApi.update(editingAsset.id, formData);
        toast.success("Asset updated");
      } else {
        await assetApi.create(propertyId, formData);
        toast.success("Asset created");
      }
      setModalOpen(false);
      resetForm();
      fetchData();
      onUpdate();
    } catch {
      toast.error(editingAsset ? "Failed to update asset" : "Failed to create asset");
    }
  };

  const handleViewDetail = async (asset: Asset) => {
    try {
      const res = await assetApi.getById(asset.id);
      setDetailAsset(res.data.data);
      setDetailOpen(true);
    } catch {
      toast.error("Failed to load asset details");
    }
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
      fetchData();
      onUpdate();
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <TableLoading />;

  return (
    <div>
      <div className="mb-3 flex justify-between">
        <div>
          {selectedIds.size > 0 && hasPermission(P.ASSETS.DEACTIVATE) && (
            <button onClick={handleBulkDelete} disabled={deleting} className={cls.btnDanger}>
              <Trash2 size={14} />
              {deleting ? "Deleting..." : `Delete ${selectedIds.size} selected`}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {assets.length > 0 && hasPermission(P.ASSETS.EXPORT) && (
            <button
              onClick={() => {
                const escape = (v: any) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
                const rows = [
                  ["Code", "Name", "Category", "Floor", "Condition", "Quantity", "Unit of Measure", "Serial Number", "Purchase Date", "Status"],
                  ...assets.map(a => [a.code, a.name, a.category?.name ?? "", a.floor?.name ?? "", a.condition, a.quantity, a.unitOfMeasure, a.serialNumber ?? "", a.purchaseDate ? a.purchaseDate.slice(0, 10) : "", a.status]),
                ];
                const csv = rows.map(r => r.map(escape).join(",")).join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = `${propertyName}_assets.csv`;
                a.click();
              }}
              className={cls.btnSecondary}
            >
              <Download size={14} />
              Export
            </button>
          )}
          {hasPermission(P.ASSETS.IMPORT) && (
            <button onClick={() => setBulkOpen(true)} className={cls.btnSecondary}>
              <Upload size={14} />
              Bulk Import
            </button>
          )}
          {hasPermission(P.ASSETS.CREATE) && (
            <button onClick={openAdd} className={cls.btnPrimary}>
              <Plus size={14} />
              Add Asset
            </button>
          )}
        </div>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={<Package size={40} />}
          title="No assets added yet"
          subtitle="Add your first asset to get started"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className={cls.table}>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === assets.length && assets.length > 0}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
                <th className={cls.th}>Code</th>
                <th className={cls.th}>Name</th>
                <th className={cls.th}>Category</th>
                <th className={cls.th}>Floor</th>
                <th className={cls.th}>Condition</th>
                <th className={cls.th}>Status</th>
                <th className={cls.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className={`${cls.tr} ${selectedIds.has(asset.id) ? "bg-primary-50/40" : ""}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(asset.id)}
                      onChange={() => toggleSelect(asset.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td className={`${cls.td} ${cls.mono}`}>{asset.code}</td>
                  <td className={`${cls.td} font-medium`}>{asset.name}</td>
                  <td className={`${cls.td} text-gray-600`}>{asset.category.name}</td>
                  <td className={`${cls.td} text-gray-600`}>{asset.floor?.name || "\u2014"}</td>
                  <td className={cls.td}><ConditionBadge condition={asset.condition} /></td>
                  <td className={cls.td}><ActiveBadge status={asset.status} /></td>
                  <td className={cls.td}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleViewDetail(asset)} className={cls.btnIcon} title="View Details">
                        <Eye size={15} />
                      </button>
                      {hasPermission(P.ASSETS.EDIT) && (
                        <button onClick={() => openEdit(asset)} className={cls.btnIcon} title="Edit Asset">
                          <Pencil size={15} />
                        </button>
                      )}
                      <a
                        href={`/asset-view/${asset.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium text-primary-600 hover:bg-primary-50"
                      >
                        QR Page
                      </a>
                      {hasPermission(P.ASSETS.DEACTIVATE) && (
                        <button
                          onClick={() => handleToggleStatus(asset)}
                          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Asset Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingAsset ? "Edit Asset" : "Add Asset"}
      >
        <div className="space-y-3">
          <div>
            <label className={cls.label}>Asset Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={cls.input} placeholder="Enter asset name" />
          </div>

          <div>
            <label className={cls.label}>Category <span className="text-red-500">*</span></label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`w-full ${cls.select}`}>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={cls.label}>Unit of Measure <span className="text-red-500">*</span></label>
            <input type="text" value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} className={cls.input} placeholder="e.g. Piece, Unit, Set" />
          </div>

          <div>
            <label className={cls.label}>Quantity <span className="text-red-500">*</span></label>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={cls.input} placeholder="e.g. 1" />
          </div>

          <div>
            <label className={cls.label}>Condition <span className="text-red-500">*</span></label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)} className={`w-full ${cls.select}`}>
              <option value="">Select condition</option>
              <option value="EXCELLENT">Excellent</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select>
          </div>

          <div>
            <label className={cls.label}>Additional Information</label>
            <textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={2} className={cls.textarea} placeholder="Optional..." />
          </div>

          <div>
            <label className={cls.label}>Select Floor <span className="text-red-500">*</span></label>
            <select value={floorId} onChange={(e) => setFloorId(e.target.value)} className={`w-full ${cls.select}`}>
              <option value="">Select floor</option>
              {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div>
            <label className={cls.label}>Serial Number</label>
            <input type="text" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={cls.input} placeholder="If applicable" />
          </div>

          <div>
            <label className={cls.label}>Purchase Date</label>
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} max={new Date().toISOString().split("T")[0]} className={cls.input} />
          </div>

          <div>
            <label className={cls.label}>Asset Image</label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-md bg-primary-50 px-3 py-1.5 text-[13px] font-medium text-primary-600 hover:bg-primary-100">
                Choose File
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be under 5MB");
                      e.target.value = "";
                      return;
                    }
                    setImage(file);
                  }}
                  className="hidden"
                />
              </label>
              {image ? (
                <span className="text-[13px] font-medium text-green-600">Photo selected</span>
              ) : editingAsset?.imagePath ? (
                <span className="text-[13px] text-gray-500">Current photo set</span>
              ) : (
                <span className="text-[13px] text-gray-400">No image selected</span>
              )}
            </div>
            {editingAsset && !image && editingAsset.imagePath && (
              <div className="mt-2">
                <img src={assetUrl(editingAsset.imagePath)} alt="Current" className="h-28 w-28 rounded-md object-cover ring-1 ring-gray-100" />
                <p className="mt-1 text-[11px] text-gray-400">Current image will be kept if no new image is selected.</p>
              </div>
            )}
            {image && (
              <div className="mt-2">
                <img src={URL.createObjectURL(image)} alt="Preview" className="h-28 w-28 rounded-md object-cover ring-1 ring-gray-100" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setModalOpen(false); resetForm(); }} className={cls.btnSecondary}>Cancel</button>
            <button onClick={handleSave} className={cls.btnPrimary}>
              {editingAsset ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <BulkImportModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk Import Assets"
        columns={[
          { key: "floorName", label: "Floor", required: true, example: "Ground" },
          { key: "name", label: "Name", required: true, example: "Split AC Unit" },
          { key: "categoryName", label: "Category", required: true, example: "HVAC" },
          { key: "quantity", label: "Quantity", required: false, example: "5" },
          { key: "unitOfMeasure", label: "Unit of Measure", required: false, example: "NOS" },
          { key: "additionalInfo", label: "Additional Info", required: false, example: "Brand X" },
          { key: "condition", label: "Condition", required: false, example: "GOOD" },
          { key: "serialNumber", label: "Serial Number", required: false, example: "SN-12345" },
          { key: "purchaseDate", label: "Purchase Date", required: false, example: "2024-01-15" },
        ]}
        onImport={async (items) => {
          const res = await assetApi.bulkImport(propertyId, items);
          return res.data.data;
        }}
        onComplete={() => {
          fetchData();
          onUpdate();
        }}
      />

      {/* Asset Detail Modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title="Asset Details">
        {detailAsset && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <span className="text-[11px] text-gray-500">Code</span>
                <p className={cls.mono}>{detailAsset.code}</p>
              </div>
              <div>
                <span className="text-[11px] text-gray-500">Name</span>
                <p className="font-medium">{detailAsset.name}</p>
              </div>
              <div>
                <span className="text-[11px] text-gray-500">Category</span>
                <p className="font-medium">{detailAsset.category?.name}</p>
              </div>
              <div>
                <span className="text-[11px] text-gray-500">Condition</span>
                <p className="mt-0.5"><ConditionBadge condition={detailAsset.condition} /></p>
              </div>
              <div>
                <span className="text-[11px] text-gray-500">Floor</span>
                <p className="font-medium">{detailAsset.floor?.name || "\u2014"}</p>
              </div>
              <div>
                <span className="text-[11px] text-gray-500">Property</span>
                <p className="font-medium">{detailAsset.property?.name}</p>
              </div>
              <div>
                <span className="text-[11px] text-gray-500">Unit of Measure</span>
                <p className="font-medium">{detailAsset.unitOfMeasure}</p>
              </div>
              <div>
                <span className="text-[11px] text-gray-500">Quantity</span>
                <p className="font-medium">{detailAsset.quantity || 1}</p>
              </div>
              {detailAsset.serialNumber && (
                <div>
                  <span className="text-[11px] text-gray-500">Serial Number</span>
                  <p className="font-medium">{detailAsset.serialNumber}</p>
                </div>
              )}
              {detailAsset.purchaseDate && (
                <div>
                  <span className="text-[11px] text-gray-500">Purchase Date</span>
                  <p className="font-medium">{new Date(detailAsset.purchaseDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>

            {detailAsset.additionalInfo && (
              <div className="text-[13px]">
                <span className="text-[11px] text-gray-500">Additional Info</span>
                <p className="mt-0.5">{detailAsset.additionalInfo}</p>
              </div>
            )}

            {detailAsset.imagePath && (
              <img src={assetUrl(detailAsset.imagePath)} alt={detailAsset.name} className="h-36 w-full rounded-md object-cover" />
            )}

            <div className="text-center">
              <p className="mb-1.5 text-[11px] text-gray-500">QR Code</p>
              {detailAsset.qrCode ? (
                <>
                  <img src={assetUrl(detailAsset.qrCode)} alt="QR Code" className="mx-auto h-36 w-36" />
                  <a
                    href={`/${detailAsset.qrCode}`}
                    download={`${detailAsset.code}-qrcode.png`}
                    className={`mt-2 inline-flex ${cls.btnPrimary}`}
                  >
                    <Download size={13} />
                    Download QR Code
                  </a>
                </>
              ) : (
                <p className="py-2 text-[11px] text-gray-400">QR code not yet generated</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
