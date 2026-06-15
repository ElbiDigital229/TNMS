import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { acquisitionAgentApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import { ArrowLeft, Star } from "lucide-react";
import { cls } from "../lib/styles";

const PK_CITIES = ["Lahore", "Islamabad", "Karachi", "Rawalpindi"] as const;

// ─── Mini star-rating input (re-defined locally for now) ─────────────────
function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 20,
}: {
  value: number;
  onChange?: (n: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"}
          title={`${n} of 5`}
        >
          <Star size={size} className={n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
        </button>
      ))}
    </div>
  );
}

const emptyForm = {
  agentName: "",
  companyName: "",
  contactNumber: "",
  email: "",
  city: "",
  areaFocus: "",
  sourceType: "BROKER",
  rating: 3,
  firstContactDate: "",
  status: "ACTIVE",
  lastAvailabilityCheck: "",
  notes: "",
};

export default function AcquisitionAgentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [agentCode, setAgentCode] = useState<string>("");

  // Load existing agent when editing
  useEffect(() => {
    if (!isEdit) return;
    acquisitionAgentApi
      .getById(id!)
      .then((res) => {
        const a = res.data.data;
        setAgentCode(a.agentCode);
        setForm({
          agentName: a.agentName,
          companyName: a.companyName || "",
          contactNumber: a.contactNumber,
          email: a.email || "",
          city: a.city,
          areaFocus: a.areaFocus || "",
          sourceType: a.sourceType,
          rating: a.rating,
          firstContactDate: a.firstContactDate ? a.firstContactDate.slice(0, 10) : "",
          status: a.status,
          lastAvailabilityCheck: a.lastAvailabilityCheck ? a.lastAvailabilityCheck.slice(0, 10) : "",
          notes: a.notes || "",
        });
      })
      .catch(() => toast.error("Failed to load agent"))
      .finally(() => setLoading(false));
  }, [id, isEdit, toast]);

  const updateForm = (k: keyof typeof emptyForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.agentName.trim()) return toast.error("Agent name is required");
    if (!form.contactNumber.trim()) return toast.error("Contact number is required");
    if (!form.city.trim()) return toast.error("City is required");

    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) await acquisitionAgentApi.update(id!, payload);
      else await acquisitionAgentApi.create(payload);
      toast.success(isEdit ? "Agent updated" : "Agent created");
      navigate("/acquisitions/agents");
    } catch (err: any) {
      const data = err.response?.data;
      let msg = data?.error || "Failed to save agent";
      if (Array.isArray(data?.details) && data.details.length > 0) {
        msg = `${msg} — ${data.details.map((d: any) => `${d.path}: ${d.message}`).join("; ")}`;
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div>
      <button
        onClick={() => navigate("/acquisitions/agents")}
        className="mb-3 flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Agents
      </button>

      <PageHeader title={isEdit ? `Edit Agent — ${agentCode}` : "Create Agent"} />

      <div className={`mx-auto max-w-2xl ${cls.card} p-4`}>
        <div className="space-y-3">
          {/* Agent Name */}
          <div>
            <label className={cls.label}>
              Agent Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.agentName}
              onChange={(e) => updateForm("agentName", e.target.value)}
              className={cls.input}
              placeholder="Enter agent name"
            />
          </div>

          {/* Company Name */}
          <div>
            <label className={cls.label}>Company Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => updateForm("companyName", e.target.value)}
              className={cls.input}
              placeholder="e.g. Skyline Realtors"
            />
          </div>

          {/* Contact Number + Email (paired) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.contactNumber}
                onChange={(e) => updateForm("contactNumber", e.target.value)}
                className={cls.input}
                placeholder="+92-300-1234567"
              />
            </div>
            <div>
              <label className={cls.label}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                className={cls.input}
                placeholder="agent@example.com"
              />
            </div>
          </div>

          {/* City + Area Focus (paired) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>
                City <span className="text-red-500">*</span>
              </label>
              <select
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
                className={`w-full ${cls.select}`}
              >
                <option value="">Select city</option>
                {PK_CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {/* Preserve a legacy value that's not in the standard list */}
                {form.city && !PK_CITIES.includes(form.city as typeof PK_CITIES[number]) && (
                  <option value={form.city}>{form.city}</option>
                )}
              </select>
            </div>
            <div>
              <label className={cls.label}>Area Focus</label>
              <input
                type="text"
                value={form.areaFocus}
                onChange={(e) => updateForm("areaFocus", e.target.value)}
                className={cls.input}
                placeholder="e.g. DHA Phase 5"
              />
            </div>
          </div>

          {/* Source Type */}
          <div>
            <label className={cls.label}>
              Source Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.sourceType}
              onChange={(e) => updateForm("sourceType", e.target.value)}
              className={`w-full ${cls.select}`}
            >
              <option value="BROKER">Broker</option>
              <option value="OWNER">Owner</option>
              <option value="CONSULTANT">Consultant</option>
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className={cls.label}>Rating</label>
            <div className="pt-1">
              <StarRating value={form.rating} onChange={(n) => updateForm("rating", n)} />
            </div>
          </div>

          {/* First Contact Date + Last Availability Check (paired) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>First Contact Date</label>
              <input
                type="date"
                value={form.firstContactDate}
                onChange={(e) => updateForm("firstContactDate", e.target.value)}
                className={cls.input}
              />
            </div>
            <div>
              <label className={cls.label}>Last Availability Check</label>
              <input
                type="date"
                value={form.lastAvailabilityCheck}
                onChange={(e) => updateForm("lastAvailabilityCheck", e.target.value)}
                className={cls.input}
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={cls.label}>Status</label>
            <select
              value={form.status}
              onChange={(e) => updateForm("status", e.target.value)}
              className={`w-full ${cls.select}`}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className={cls.label}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateForm("notes", e.target.value)}
              rows={4}
              className={cls.textarea || cls.input}
              placeholder="Anything worth remembering about this contact"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button onClick={() => navigate("/acquisitions/agents")} className={cls.btnSecondary}>
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving} className={cls.btnPrimary}>
              {saving ? "Saving…" : isEdit ? "Update Agent" : "Create Agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
