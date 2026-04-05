import { useState, useEffect } from "react";
import { areaGroupApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { TableLoading } from "../components/ui/DataTable";
import { CITY_LABELS } from "../../../shared/types";
import { Pencil, Check, X } from "lucide-react";

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

  if (loading) return <TableLoading />;

  const cities = ["LAHORE", "ISLAMABAD"];

  return (
    <div>
      <PageHeader
        title="Area Grouping"
        subtitle="Each city is assigned to one area group. Properties in that city will automatically be associated with the group."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cities.map((city) => (
          <div key={city} className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-gray-900">
                {CITY_LABELS[city]}
              </h3>
              {!editing[city] && (
                <button onClick={() => handleEdit(city)} className={cls.btnSecondary}>
                  <Pencil size={14} />
                  Edit
                </button>
              )}
            </div>

            {editing[city] ? (
              <div>
                <label className={cls.label}>Group Name</label>
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
                    className={`flex-1 ${cls.input}`}
                    placeholder="Enter group name"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSave(city)}
                    disabled={saving[city]}
                    className={cls.btnPrimary}
                    title="Save"
                  >
                    <Check size={14} />
                    {saving[city] ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => handleCancel(city)}
                    className={cls.btnSecondary}
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  Group Name
                </span>
                <p className="mt-0.5 text-[13px] font-medium text-gray-900">
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
