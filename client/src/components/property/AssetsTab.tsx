import { useState, useEffect } from "react";
import { assetApi, unitApi, assetCategoryApi } from "../../lib/api";
import { useToast } from "../ui/Toast";
import Modal from "../ui/Modal";
import BulkImportModal from "../ui/BulkImportModal";
import { Plus, Eye, Pencil, Package, Upload, Download } from "lucide-react";
import { CONDITION_LABELS } from "../../../../shared/types";

interface Asset {
  id: string;
  code: string;
  name: string;
  condition: string;
  status: string;
  unitOfMeasure: string;
  additionalInfo?: string;
  serialNumber?: string;
  purchaseDate?: string;
  imagePath?: string;
  unit: { id: string; name: string; code: string };
  category: { id: string; name: string };
}

interface Unit {
  id: string;
  code: string;
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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [condition, setCondition] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [unitId, setUnitId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [image, setImage] = useState<File | null>(null);

  const fetchData = () => {
    Promise.all([
      assetApi.listByProperty(propertyId),
      unitApi.list(propertyId),
      assetCategoryApi.list(),
    ])
      .then(([assetsRes, unitsRes, catsRes]) => {
        setAssets(assetsRes.data.data);
        setUnits(
          unitsRes.data.data.filter((u: Unit) => u.status === "ACTIVE")
        );
        setCategories(
          catsRes.data.data.filter((c: Category) => c.status === "ACTIVE")
        );
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [propertyId]);

  const resetForm = () => {
    setName("");
    setCategoryId("");
    setUnitOfMeasure("");
    setCondition("");
    setAdditionalInfo("");
    setUnitId("");
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
      setCondition(full.condition);
      setAdditionalInfo(full.additionalInfo || "");
      setUnitId(full.unitId || full.unit?.id || "");
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
    if (!name || !categoryId || !unitOfMeasure || !condition || !unitId) {
      toast.error("Please fill all required fields");
      return;
    }

    if (purchaseDate && new Date(purchaseDate) > new Date()) {
      toast.error("Purchase date cannot be in the future");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("categoryId", categoryId);
    formData.append("unitOfMeasure", unitOfMeasure);
    formData.append("condition", condition);
    if (additionalInfo) formData.append("additionalInfo", additionalInfo);
    formData.append("unitId", unitId);
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

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600" />
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <button
          onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
        >
          <Upload size={16} />
          Bulk Import
        </button>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
        >
          <Plus size={16} />
          Add Asset
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Package size={48} className="mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">No assets added yet</p>
          <p className="mt-1 text-sm text-gray-400">Add your first asset to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Code
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Category
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Unit
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  Condition
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
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-gray-100/80 transition-colors duration-150 hover:bg-gray-50/80"
                >
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-primary-600">
                    {asset.code}
                  </td>
                  <td className="px-5 py-3.5 font-medium">{asset.name}</td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {asset.category.name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {asset.unit.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        asset.condition === "EXCELLENT"
                          ? "bg-green-50 text-green-600"
                          : asset.condition === "GOOD"
                            ? "bg-blue-50 text-blue-600"
                            : asset.condition === "FAIR"
                              ? "bg-yellow-50 text-yellow-600"
                              : "bg-red-50 text-red-600"
                      }`}
                    >
                      {CONDITION_LABELS[asset.condition]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        asset.status === "ACTIVE"
                          ? "bg-green-50 text-green-600"
                          : "bg-red-50 text-red-600"
                      }`}
                    >
                      {asset.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(asset)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(asset)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Edit Asset"
                      >
                        <Pencil size={16} />
                      </button>
                      <a
                        href={`/asset-view/${asset.code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded px-2 py-0.5 text-xs font-medium text-primary-600 hover:bg-primary-50"
                      >
                        QR Page
                      </a>
                      <button
                        onClick={() => handleToggleStatus(asset)}
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          asset.status === "ACTIVE"
                            ? "text-red-600 hover:bg-red-50"
                            : "text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {asset.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
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
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingAsset ? "Edit Asset" : "Add Asset"}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Asset Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter asset name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Unit of Measure <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="e.g. Piece, Unit, Set"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Condition <span className="text-red-500">*</span>
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select condition</option>
              <option value="EXCELLENT">Excellent</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Additional Information
            </label>
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Optional..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Select Unit <span className="text-red-500">*</span>
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Serial Number
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="If applicable"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Asset Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-600 hover:file:bg-primary-100"
            />
            {editingAsset && !image && editingAsset.imagePath && (
              <p className="mt-1 text-xs text-gray-400">
                Current image will be kept if no new image is selected.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
            >
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
          { key: "name", label: "Name", required: true, example: "Split AC Unit" },
          { key: "categoryName", label: "Category", required: true, example: "HVAC" },
          { key: "unitOfMeasure", label: "Unit of Measure", required: true, example: "Piece" },
          { key: "condition", label: "Condition", required: true, example: "GOOD" },
          { key: "unitCode", label: "Unit Code", required: true, example: "UNT001" },
          { key: "serialNumber", label: "Serial Number", required: false, example: "SN-12345" },
          { key: "purchaseDate", label: "Purchase Date", required: false, example: "2024-01-15" },
          { key: "additionalInfo", label: "Additional Info", required: false, example: "Brand X" },
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
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Asset Details"
      >
        {detailAsset && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Code</span>
                <p className="font-mono font-bold text-primary-600">
                  {detailAsset.code}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Name</span>
                <p className="font-medium">{detailAsset.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Category</span>
                <p className="font-medium">{detailAsset.category?.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Condition</span>
                <p className="font-medium">
                  {CONDITION_LABELS[detailAsset.condition]}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Unit</span>
                <p className="font-medium">{detailAsset.unit?.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Floor</span>
                <p className="font-medium">
                  {detailAsset.unit?.floor?.name || "\u2014"}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Property</span>
                <p className="font-medium">{detailAsset.property?.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Unit of Measure</span>
                <p className="font-medium">{detailAsset.unitOfMeasure}</p>
              </div>
              {detailAsset.serialNumber && (
                <div>
                  <span className="text-gray-500">Serial Number</span>
                  <p className="font-medium">{detailAsset.serialNumber}</p>
                </div>
              )}
              {detailAsset.purchaseDate && (
                <div>
                  <span className="text-gray-500">Purchase Date</span>
                  <p className="font-medium">
                    {new Date(detailAsset.purchaseDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {detailAsset.additionalInfo && (
              <div className="text-sm">
                <span className="text-gray-500">Additional Info</span>
                <p className="mt-1">{detailAsset.additionalInfo}</p>
              </div>
            )}

            {detailAsset.imagePath && (
              <img
                src={`/${detailAsset.imagePath}`}
                alt={detailAsset.name}
                className="h-40 w-full rounded-lg object-cover"
              />
            )}

            <div className="text-center">
              <p className="mb-2 text-sm text-gray-500">QR Code</p>
              {detailAsset.qrCode ? (
                <>
                  <img
                    src={`/${detailAsset.qrCode}`}
                    alt="QR Code"
                    className="mx-auto h-40 w-40"
                  />
                  <a
                    href={`/${detailAsset.qrCode}`}
                    download={`${detailAsset.code}-qrcode.png`}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
                  >
                    <Download size={14} />
                    Download QR Code
                  </a>
                </>
              ) : (
                <p className="py-2 text-xs text-gray-400">
                  QR code not yet generated
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
