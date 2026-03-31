import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { assetApi, assetCategoryApi } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/ui/Toast";
import Modal from "../components/ui/Modal";
import { CONDITION_LABELS } from "../../../shared/types";
import { Building2, Download, Edit2, Layers, MapPin, Package } from "lucide-react";

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR"] as const;
const UNITS_OF_MEASURE = ["NOS", "MTR", "SFT", "SET", "LOT", "KG", "LTR", "PKT", "BOX", "ROLL"] as const;

export default function AssetDetailPage() {
  const { code } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [editForm, setEditForm] = useState({
    name: "",
    categoryId: "",
    unitOfMeasure: "",
    condition: "",
    serialNumber: "",
    additionalInfo: "",
  });

  const canEdit = user?.isSuperAdmin || user?.permissions?.includes("assets.edit");

  const fetchAsset = () => {
    if (!code) return;
    assetApi
      .getByCode(code)
      .then((res) => {
        if (res.data.success) {
          setAsset(res.data.data);
        } else {
          setError("Asset not found");
        }
      })
      .catch(() => setError("Failed to load asset"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAsset();
    assetCategoryApi.list().then((res) => setCategories(res.data.data)).catch(() => {});
  }, [code]);

  const openEdit = () => {
    setEditForm({
      name: asset.name || "",
      categoryId: asset.category?.id || asset.categoryId || "",
      unitOfMeasure: asset.unitOfMeasure || "",
      condition: asset.condition || "",
      serialNumber: asset.serialNumber || "",
      additionalInfo: asset.additionalInfo || "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", editForm.name);
      formData.append("categoryId", editForm.categoryId);
      formData.append("unitOfMeasure", editForm.unitOfMeasure);
      formData.append("condition", editForm.condition);
      formData.append("serialNumber", editForm.serialNumber);
      formData.append("additionalInfo", editForm.additionalInfo);
      await assetApi.update(asset.id, formData);
      toast.success("Asset updated");
      setEditOpen(false);
      fetchAsset();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update asset");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="py-12 text-center">
        <Package size={48} className="mx-auto text-gray-300" />
        <h1 className="mt-3 text-xl font-semibold text-gray-900">Asset Not Found</h1>
        <p className="mt-1 text-[13px] text-gray-500">{error || "The asset you are looking for does not exist."}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{asset.name}</h1>
              <p className="mt-1 font-mono text-sm text-primary-600">
                {asset.code}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={openEdit}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 transition-colors"
                >
                  <Edit2 size={13} />
                  Edit
                </button>
              )}
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                  asset.status === "ACTIVE"
                    ? "bg-green-50 text-green-600"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {asset.status}
              </span>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Building2 size={14} />
            <span>{asset.property?.name}</span>
            <span>/</span>
            <Layers size={14} />
            <span>{asset.floor?.name}</span>
          </div>
        </div>

        {/* Details */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[13px] text-gray-500">Category</span>
              <p className="font-medium">{asset.category?.name}</p>
            </div>
            <div>
              <span className="text-[13px] text-gray-500">Condition</span>
              <p className="font-medium">
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
              </p>
            </div>
            <div>
              <span className="text-[13px] text-gray-500">Unit of Measure</span>
              <p className="font-medium">{asset.unitOfMeasure}</p>
            </div>
            {asset.serialNumber && (
              <div>
                <span className="text-[13px] text-gray-500">Serial Number</span>
                <p className="font-medium">{asset.serialNumber}</p>
              </div>
            )}
            {asset.purchaseDate && (
              <div>
                <span className="text-[13px] text-gray-500">Purchase Date</span>
                <p className="font-medium">
                  {new Date(asset.purchaseDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          {asset.additionalInfo && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <span className="text-[13px] text-gray-500">
                Additional Information
              </span>
              <p className="mt-1 text-sm">{asset.additionalInfo}</p>
            </div>
          )}
        </div>

        {/* Image */}
        {asset.imagePath && (
          <div className="mb-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Image</h2>
            <img
              src={`/${asset.imagePath}`}
              alt={asset.name}
              className="w-full rounded-lg object-cover"
            />
          </div>
        )}

        {/* QR Code */}
        <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-950/5">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            QR Code
          </h2>
          {asset.qrCode ? (
            <>
              <img
                src={`/${asset.qrCode}`}
                alt="QR Code"
                className="mx-auto h-48 w-48"
              />
              <p className="mt-2 text-[13px] text-gray-500">
                Scan this QR code to view asset details
              </p>
              <a
                href={`/${asset.qrCode}`}
                download={`${asset.code}-qrcode.png`}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700"
              >
                <Download size={16} />
                Download QR Code
              </a>
            </>
          ) : (
            <div className="py-4">
              <Package size={32} className="mx-auto text-gray-300" />
              <p className="mt-2 text-[13px] text-gray-500">
                QR code has not been generated for this asset yet.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Asset">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Name</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Category</label>
            <select
              value={editForm.categoryId}
              onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Condition</label>
              <select
                value={editForm.condition}
                onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              >
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Unit of Measure</label>
              <select
                value={editForm.unitOfMeasure}
                onChange={(e) => setEditForm((f) => ({ ...f, unitOfMeasure: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              >
                {UNITS_OF_MEASURE.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Serial Number</label>
            <input
              value={editForm.serialNumber}
              onChange={(e) => setEditForm((f) => ({ ...f, serialNumber: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Additional Info</label>
            <textarea
              value={editForm.additionalInfo}
              onChange={(e) => setEditForm((f) => ({ ...f, additionalInfo: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setEditOpen(false)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !editForm.name.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
