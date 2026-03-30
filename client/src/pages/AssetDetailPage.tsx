import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { assetApi } from "../lib/api";
import { CONDITION_LABELS } from "../../../shared/types";
import { Building2, Download, Layers, MapPin, Package } from "lucide-react";

export default function AssetDetailPage() {
  const { code } = useParams();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
  }, [code]);

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
    </div>
  );
}
