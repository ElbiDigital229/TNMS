import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { propertyApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import LocationDisplay from "../components/map/LocationDisplay";
import FloorsTab from "../components/property/FloorsTab";
import UnitsTab from "../components/property/UnitsTab";
import AssetsTab from "../components/property/AssetsTab";
import {
  ArrowLeft,
  Pencil,
  Building2,
  MapPin,
  Layers,
  ImageOff,
  MapPinOff,
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
  description: string | null;
  imagePath: string | null;
  latitude: number | null;
  longitude: number | null;
  areaGroup: { groupName: string } | null;
  _count: { floors: number; units: number; assets: number };
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const P = PERMISSIONS;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("floors");

  const fetchProperty = () => {
    propertyApi
      .getById(id!)
      .then((res) => setProperty(res.data.data))
      .catch(() => toast.error("Failed to load property"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const handleToggleStatus = async () => {
    if (!property) return;
    try {
      if (property.status === "ACTIVE") {
        await propertyApi.deactivate(property.id);
        toast.success("Property deactivated");
      } else {
        await propertyApi.activate(property.id);
        toast.success("Property activated");
      }
      fetchProperty();
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="py-12 text-center text-gray-500">Property not found</div>
    );
  }

  const tabs = [
    { key: "floors", label: "Floors", count: property._count.floors },
    { key: "units", label: "Units", count: property._count.units },
    { key: "assets", label: "Assets", count: property._count.assets },
  ];

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate("/properties")}
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back to Properties
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {property.name}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                property.status === "ACTIVE"
                  ? "bg-green-50 text-green-600 ring-1 ring-green-600/10"
                  : "bg-red-50 text-red-600 ring-1 ring-red-600/10"
              }`}
            >
              {property.status}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-primary-600">
            {property.code}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(P.PROPERTIES.EDIT) && (
          <Link
            to={`/properties/${property.id}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-50"
          >
            <Pencil size={16} />
            Edit
          </Link>
          )}
          {hasPermission(P.PROPERTIES.DEACTIVATE) && (
          <button
            onClick={handleToggleStatus}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all duration-200 ${
              property.status === "ACTIVE"
                ? "bg-red-50 text-red-600 hover:bg-red-100"
                : "bg-green-50 text-green-600 hover:bg-green-100"
            }`}
          >
            {property.status === "ACTIVE" ? "Deactivate" : "Activate"}
          </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Details */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
            <Building2 size={16} />
            Details
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium">
                {PROPERTY_TYPE_LABELS[property.type]}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">City</dt>
              <dd className="font-medium">
                {CITY_LABELS[property.city]}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Area Group</dt>
              <dd className="font-medium">
                {property.areaGroup?.groupName || "—"}
              </dd>
            </div>
          </dl>
          {property.description && (
            <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-600">
              {property.description}
            </p>
          )}
        </div>

        {/* Image */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
            <Layers size={16} />
            Image
          </h3>
          {property.imagePath ? (
            <img
              src={`/${property.imagePath}`}
              alt={property.name}
              className="h-40 w-full rounded-lg object-contain bg-gray-50"
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              <ImageOff size={20} className="mb-1" />
              No image
            </div>
          )}
        </div>

        {/* Map */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-gray-900">
            <MapPin size={16} />
            Location
          </h3>
          {property.latitude && property.longitude ? (
            <LocationDisplay
              lat={property.latitude}
              lng={property.longitude}
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg bg-gray-100 text-gray-400">
              <MapPinOff size={20} className="mb-1" />
              No location set
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-[13px] font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary-600 text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5">
          {activeTab === "floors" && (
            <FloorsTab
              propertyId={property.id}
              propertyName={property.name}
              onUpdate={fetchProperty}
            />
          )}
          {activeTab === "units" && (
            <UnitsTab
              propertyId={property.id}
              propertyName={property.name}
              onUpdate={fetchProperty}
            />
          )}
          {activeTab === "assets" && (
            <AssetsTab
              propertyId={property.id}
              propertyName={property.name}
              onUpdate={fetchProperty}
            />
          )}
        </div>
      </div>
    </div>
  );
}
