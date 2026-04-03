import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { propertyApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import LocationPicker from "../components/map/LocationPicker";
import { ArrowLeft, X } from "lucide-react";

export default function PropertyFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [propertyCode, setPropertyCode] = useState("");

  useEffect(() => {
    if (isEdit) {
      propertyApi
        .getById(id!)
        .then((res) => {
          const p = res.data.data;
          setName(p.name);
          setType(p.type);
          setCity(p.city);
          setDescription(p.description || "");
          setExistingImage(p.imagePath);
          setPropertyCode(p.code);
          if (p.latitude && p.longitude) {
            setLocation({ lat: p.latitude, lng: p.longitude });
          }
        })
        .catch(() => toast.error("Failed to load property"))
        .finally(() => setFetching(false));
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name || !type || !city) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("type", type);
    formData.append("city", city);
    if (description) formData.append("description", description);
    if (image) formData.append("image", image);
    if (removeImage) formData.append("removeImage", "true");
    if (location) {
      formData.append("latitude", location.lat.toString());
      formData.append("longitude", location.lng.toString());
    }

    try {
      if (isEdit) {
        await propertyApi.update(id!, formData);
        toast.success("Property updated");
      } else {
        await propertyApi.create(formData);
        toast.success("Property created");
      }
      navigate("/properties");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save property");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 transition-colors duration-150 hover:text-gray-900"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5">
        <h1 className="mb-6 text-lg font-semibold text-gray-900">
          {isEdit ? "Edit Property" : "Add Property"}
        </h1>

        {isEdit && propertyCode && (
          <div className="mb-4 rounded-lg bg-gray-50 px-4 py-2 ring-1 ring-gray-100">
            <span className="text-sm text-gray-500">Property Code: </span>
            <span className="font-mono text-sm font-bold text-primary-600">
              {propertyCode}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Property Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Enter property name"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                Property Type <span className="text-red-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                required
              >
                <option value="">Select type</option>
                <option value="FLOOR">Floor</option>
                <option value="BUILDING">Building</option>
                <option value="COMPOUND">Compound</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                City <span className="text-red-500">*</span>
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                required
              >
                <option value="">Select city</option>
                <option value="LAHORE">Lahore</option>
                <option value="ISLAMABAD">Islamabad</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="Property description..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Image
            </label>
            {existingImage && !image && !removeImage && (
              <div className="relative mb-2 inline-block">
                <img
                  src={`/${existingImage}`}
                  alt="Current"
                  className="h-32 w-32 rounded-lg object-cover ring-1 ring-gray-100"
                />
                <button
                  type="button"
                  onClick={() => { setRemoveImage(true); setExistingImage(null); }}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {image && (
              <div className="relative mb-2 inline-block">
                <img
                  src={URL.createObjectURL(image)}
                  alt="Preview"
                  className="h-32 w-32 rounded-lg object-cover ring-1 ring-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
                <label className="cursor-pointer rounded-lg bg-primary-50 px-4 py-2 text-sm font-medium text-primary-600 hover:bg-primary-100">
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
                  <span className="text-sm font-medium text-green-600">Photo selected</span>
                ) : existingImage ? (
                  <span className="text-sm text-gray-500">Current photo set</span>
                ) : (
                  <span className="text-sm text-gray-400">No image selected</span>
                )}
              </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Map Location
            </label>
            <LocationPicker value={location} onChange={setLocation} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 transition-all duration-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : isEdit
                  ? "Update Property"
                  : "Create Property"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
