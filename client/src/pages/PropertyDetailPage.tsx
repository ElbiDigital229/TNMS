import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { propertyApi, assetUrl } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import { cls } from "../lib/styles";
import { ActiveBadge } from "../components/ui/Badge";
import { TableLoading } from "../components/ui/DataTable";
import LocationDisplay from "../components/map/LocationDisplay";
import FloorsTab from "../components/property/FloorsTab";
import UnitsTab from "../components/property/UnitsTab";
import AssetsTab from "../components/property/AssetsTab";
import TicketsTab from "../components/property/TicketsTab";
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
  _count: { floors: number; units: number; assets: number; tickets: number };
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

  if (loading) return <TableLoading />;

  if (!property) {
    return (
      <div className="py-12 text-center text-gray-500">Property not found</div>
    );
  }

  const tabs = [
    { key: "floors", label: "Floors", count: property._count.floors },
    { key: "units", label: "Units", count: property._count.units },
    { key: "assets", label: "Assets", count: property._count.assets },
    { key: "tickets", label: "Tickets", count: property._count.tickets },
  ];

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate("/properties")}
        className="mb-3 flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to Properties
      </button>

      {/* Header */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={cls.pageTitle}>{property.name}</h1>
            <ActiveBadge status={property.status} />
          </div>
          <p className={`mt-0.5 ${cls.mono}`}>{property.code}</p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(P.PROPERTIES.EDIT) && (
            <Link to={`/properties/${property.id}/edit`} className={cls.btnSecondary}>
              <Pencil size={14} />
              Edit
            </Link>
          )}
          {hasPermission(P.PROPERTIES.DEACTIVATE) && (
            <button
              onClick={handleToggleStatus}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
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
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Details */}
        <div className={`${cls.card} p-4`}>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
            <Building2 size={15} />
            Details
          </h3>
          <dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-gray-500">Type</dt>
              <dd className="font-medium">{PROPERTY_TYPE_LABELS[property.type]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">City</dt>
              <dd className="font-medium">{CITY_LABELS[property.city]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Area Group</dt>
              <dd className="font-medium">{property.areaGroup?.groupName || "\u2014"}</dd>
            </div>
          </dl>
          {property.description && (
            <p className="mt-2 border-t border-gray-100 pt-2 text-[13px] text-gray-600">
              {property.description}
            </p>
          )}
        </div>

        {/* Image */}
        <div className={`${cls.card} p-4`}>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
            <Layers size={15} />
            Image
          </h3>
          {property.imagePath ? (
            <img
              src={assetUrl(property.imagePath)}
              alt={property.name}
              className="h-36 w-full rounded-md object-contain bg-gray-50"
            />
          ) : (
            <div className="flex h-36 flex-col items-center justify-center rounded-md bg-gray-100 text-gray-400">
              <ImageOff size={18} className="mb-1" />
              <span className="text-[11px]">No image</span>
            </div>
          )}
        </div>

        {/* Map */}
        <div className={`${cls.card} p-4`}>
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
            <MapPin size={15} />
            Location
          </h3>
          {property.latitude && property.longitude ? (
            <LocationDisplay lat={property.latitude} lng={property.longitude} />
          ) : (
            <div className="flex h-36 flex-col items-center justify-center rounded-md bg-gray-100 text-gray-400">
              <MapPinOff size={18} className="mb-1" />
              <span className="text-[11px]">No location set</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={cls.card}>
        <div className="border-b border-gray-200">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-b-2 border-primary-600 text-primary-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 inline-flex items-center rounded-full bg-gray-100 px-1.5 py-px text-[11px] text-gray-600">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4">
          {activeTab === "floors" && (
            <FloorsTab propertyId={property.id} propertyName={property.name} onUpdate={fetchProperty} />
          )}
          {activeTab === "units" && (
            <UnitsTab propertyId={property.id} propertyName={property.name} onUpdate={fetchProperty} />
          )}
          {activeTab === "assets" && (
            <AssetsTab propertyId={property.id} propertyName={property.name} onUpdate={fetchProperty} />
          )}
          {activeTab === "tickets" && (
            <TicketsTab propertyId={property.id} />
          )}
        </div>
      </div>
    </div>
  );
}
