import { useState, useEffect } from "react";
import { areaGroupApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { CITY_LABELS } from "../../../shared/types";
import { Pencil, Save, X, Check } from "lucide-react";

interface AreaGroup {
  id: string;
  city: string;
  groupName: string;
}

export default function AreaGroupSettingsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<AreaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    areaGroupApi
      .list()
      .then((res) => {
        const data = res.data.data;
        setGroups(data);
        const values: Record<string, string> = {};
        data.forEach((g: AreaGroup) => {
          values[g.city] = g.groupName;
        });
        setSavedValues(values);
        setEditValues(values);
      })
      .catch(() => toast.error("Failed to load area groups"))
      .finally(() => setLoading(false));
  }, []);

  const handleEdit = (city: string) => {
    setEditValues((prev) => ({ ...prev, [city]: savedValues[city] || "" }));
    setEditing((prev) => ({ ...prev, [city]: true }));
  };

  const handleCancel = (city: string) => {
    setEditValues((prev) => ({ ...prev, [city]: savedValues[city] || "" }));
    setEditing((prev) => ({ ...prev, [city]: false }));
  };

  const handleSave = async (city: string) => {
    const groupName = editValues[city];
    if (!groupName?.trim()) {
      toast.error("Group name is required");
      return;
    }

    setSaving((prev) => ({ ...prev, [city]: true }));
    try {
      await areaGroupApi.upsert(city, groupName.trim());
      setSavedValues((prev) => ({ ...prev, [city]: groupName.trim() }));
      setEditing((prev) => ({ ...prev, [city]: false }));
      toast.success(`${CITY_LABELS[city]} group updated`);
    } catch {
      toast.error("Failed to update group");
    } finally {
      setSaving((prev) => ({ ...prev, [city]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  const cities = ["LAHORE", "ISLAMABAD"];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Area Grouping</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Each city is assigned to one area group. Properties in that city will
          automatically be associated with the group.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cities.map((city) => (
          <div
            key={city}
            className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-950/5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {CITY_LABELS[city]}
              </h3>
              {!editing[city] && (
                <button
                  onClick={() => handleEdit(city)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                >
                  <Pencil size={14} />
                  Edit
                </button>
              )}
            </div>

            {editing[city] ? (
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
                  Group Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editValues[city] || ""}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [city]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                    placeholder="Enter group name"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSave(city)}
                    disabled={saving[city]}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 disabled:opacity-50"
                    title="Save"
                  >
                    <Check size={16} />
                    {saving[city] ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => handleCancel(city)}
                    className="inline-flex items-center rounded-lg bg-white px-3 py-2.5 text-sm text-gray-600 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Group Name
                </span>
                <p className="mt-1 text-base font-medium text-gray-900">
                  {savedValues[city] || (
                    <span className="italic text-gray-400">Not set</span>
                  )}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
