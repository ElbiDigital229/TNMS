import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { acquisitionAgentApi, acquisitionLandApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import PageHeader from "../components/ui/PageHeader";
import { ArrowLeft } from "lucide-react";
import { cls } from "../lib/styles";

interface AgentLite {
  id: string;
  agentCode: string;
  agentName: string;
  companyName: string | null;
  deletedAt: string | null;
}

const UTILITY_PRESETS = ["WATER", "GAS", "ELECTRICITY", "SEWERAGE", "INTERNET", "PHONE", "BOREWELL", "SOLAR"] as const;

const emptyForm = {
  agentId: "",
  city: "",
  areaLocation: "",
  addressDescription: "",
  coordinates: "",
  plotSizeKanal: "",
  frontRoadWidthFt: "",
  zoning: "",
  developmentStatus: "",
  maxCoveredAreaSqft: "",
  utilities: [] as string[],
  parkingPotential: "",
  proposedModel: "",
  askingPrice: "",
  ownerFlexibility: "",
  stage: "REVIEW",
  status: "ACTIVE",
  lastAvailabilityCheck: "",
  notes: "",
};

/** Format a PKR amount using Indian/PK lakh-crore grouping. */
function fmtPKR(v: string | number | null | undefined): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (Number.isNaN(n)) return "";
  const s = n.toFixed(0);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.length ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3 : last3;
  return `Rs ${grouped}`;
}

export default function AcquisitionLandFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [landCode, setLandCode] = useState("");
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [agentSearch, setAgentSearch] = useState("");

  useEffect(() => {
    acquisitionAgentApi.list({ limit: 500 })
      .then((r) => setAgents(r.data.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    acquisitionLandApi
      .getById(id!)
      .then((res) => {
        const r = res.data.data;
        setLandCode(r.landCode);
        setForm({
          agentId: r.agentId || "",
          city: r.city,
          areaLocation: r.areaLocation || "",
          addressDescription: r.addressDescription || "",
          coordinates: r.coordinates || "",
          plotSizeKanal: r.plotSizeKanal || "",
          frontRoadWidthFt: r.frontRoadWidthFt || "",
          zoning: r.zoning || "",
          developmentStatus: r.developmentStatus || "",
          maxCoveredAreaSqft: r.maxCoveredAreaSqft || "",
          utilities: r.utilities || [],
          parkingPotential: r.parkingPotential || "",
          proposedModel: r.proposedModel || "",
          askingPrice: r.askingPrice || "",
          ownerFlexibility: r.ownerFlexibility || "",
          stage: r.stage,
          status: r.status,
          lastAvailabilityCheck: r.lastAvailabilityCheck ? r.lastAvailabilityCheck.slice(0, 10) : "",
          notes: r.notes || "",
        });
      })
      .catch(() => toast.error("Failed to load land record"))
      .finally(() => setLoading(false));
  }, [id, isEdit, toast]);

  const updateForm = (k: keyof typeof emptyForm, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const toggleUtility = (u: string) => {
    setForm((f) => ({
      ...f,
      utilities: f.utilities.includes(u) ? f.utilities.filter((x) => x !== u) : [...f.utilities, u],
    }));
  };

  const filteredAgents = agentSearch.trim()
    ? agents.filter((a) =>
        a.agentCode.toLowerCase().includes(agentSearch.toLowerCase()) ||
        a.agentName.toLowerCase().includes(agentSearch.toLowerCase()) ||
        (a.companyName || "").toLowerCase().includes(agentSearch.toLowerCase()),
      )
    : agents;

  const selectedAgent = agents.find((a) => a.id === form.agentId) || null;
  const agentLabel = (a: AgentLite) =>
    `${a.agentCode} — ${a.agentName}${a.companyName ? ` (${a.companyName})` : ""}${a.deletedAt ? " [archived]" : ""}`;

  const handleSubmit = async () => {
    if (!form.city.trim()) return toast.error("City is required");
    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit) await acquisitionLandApi.update(id!, payload);
      else await acquisitionLandApi.create(payload);
      toast.success(isEdit ? "Land record updated" : "Land record created");
      navigate("/acquisitions/land");
    } catch (err: any) {
      const data = err.response?.data;
      let msg = data?.error || "Failed to save record";
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
        onClick={() => navigate("/acquisitions/land")}
        className="mb-3 flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Land
      </button>

      <PageHeader title={isEdit ? `Edit Land — ${landCode}` : "Create Land"} />

      <div className={`mx-auto max-w-2xl ${cls.card} p-4`}>
        <div className="space-y-3">
          {/* Agent picker */}
          <div>
            <label className={cls.label}>Agent</label>
            <input
              type="text"
              placeholder="Search by code, name, or company…"
              value={agentSearch}
              onChange={(e) => setAgentSearch(e.target.value)}
              className={`${cls.input} mb-1.5`}
            />
            <select
              value={form.agentId}
              onChange={(e) => updateForm("agentId", e.target.value)}
              className={`w-full ${cls.select}`}
              size={Math.min(6, filteredAgents.length + 1)}
            >
              <option value="">(No agent)</option>
              {filteredAgents.map((a) => (
                <option key={a.id} value={a.id}>
                  {agentLabel(a)}
                </option>
              ))}
            </select>
            {selectedAgent && (
              <p className="mt-1 text-[11px] text-gray-500">
                Selected: <span className={cls.mono}>{agentLabel(selectedAgent)}</span>
              </p>
            )}
          </div>

          {/* City + Area / Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>
                City <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.city} onChange={(e) => updateForm("city", e.target.value)} className={cls.input} placeholder="e.g. Lahore" />
            </div>
            <div>
              <label className={cls.label}>Area / Location</label>
              <input type="text" value={form.areaLocation} onChange={(e) => updateForm("areaLocation", e.target.value)} className={cls.input} placeholder="e.g. DHA Phase 5" />
            </div>
          </div>

          {/* Address / Description */}
          <div>
            <label className={cls.label}>Address / Description</label>
            <textarea
              value={form.addressDescription}
              onChange={(e) => updateForm("addressDescription", e.target.value)}
              rows={3}
              className={cls.textarea || cls.input}
              placeholder="Plot context, proximity, road access, etc."
            />
          </div>

          {/* Coordinates */}
          <div>
            <label className={cls.label}>
              Coordinates <span className="text-[11px] text-gray-400">(paste from Google Maps)</span>
            </label>
            <input type="text" value={form.coordinates} onChange={(e) => updateForm("coordinates", e.target.value)} className={cls.input} placeholder="33.6844, 73.0479" />
          </div>

          {/* Plot Size + Front Road Width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Plot Size (Kanal)</label>
              <input type="number" step="0.01" min="0" value={form.plotSizeKanal} onChange={(e) => updateForm("plotSizeKanal", e.target.value)} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>Front Road Width (ft)</label>
              <input type="number" step="0.01" min="0" value={form.frontRoadWidthFt} onChange={(e) => updateForm("frontRoadWidthFt", e.target.value)} className={cls.input} />
            </div>
          </div>

          {/* Zoning + Development Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Zoning</label>
              <select value={form.zoning} onChange={(e) => updateForm("zoning", e.target.value)} className={`w-full ${cls.select}`}>
                <option value="">—</option>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="MIXED_USE">Mixed Use</option>
              </select>
            </div>
            <div>
              <label className={cls.label}>Development Status</label>
              <input type="text" value={form.developmentStatus} onChange={(e) => updateForm("developmentStatus", e.target.value)} className={cls.input} placeholder="e.g. Empty plot" />
            </div>
          </div>

          {/* Max Covered Area */}
          <div>
            <label className={cls.label}>Max Covered Area (sqft)</label>
            <input type="number" step="0.01" min="0" value={form.maxCoveredAreaSqft} onChange={(e) => updateForm("maxCoveredAreaSqft", e.target.value)} className={cls.input} />
          </div>

          {/* Utilities */}
          <div>
            <label className={cls.label}>Utilities Available</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {UTILITY_PRESETS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => toggleUtility(u)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    form.utilities.includes(u) ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Parking + Proposed Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Parking Potential</label>
              <input type="text" value={form.parkingPotential} onChange={(e) => updateForm("parkingPotential", e.target.value)} className={cls.input} placeholder="e.g. 30 cars" />
            </div>
            <div>
              <label className={cls.label}>Proposed Model</label>
              <select value={form.proposedModel} onChange={(e) => updateForm("proposedModel", e.target.value)} className={`w-full ${cls.select}`}>
                <option value="">—</option>
                <option value="JV">JV</option>
                <option value="DEVELOPMENT">Development</option>
                <option value="SALE">Sale</option>
              </select>
            </div>
          </div>

          {/* Asking Price + Owner Flexibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Asking Price (PKR)</label>
              <input type="number" step="0.01" min="0" value={form.askingPrice} onChange={(e) => updateForm("askingPrice", e.target.value)} className={cls.input} placeholder="e.g. 50000000" />
              {form.askingPrice && <p className="mt-0.5 text-[11px] text-gray-500">{fmtPKR(form.askingPrice)}</p>}
            </div>
            <div>
              <label className={cls.label}>Owner Flexibility</label>
              <input type="text" value={form.ownerFlexibility} onChange={(e) => updateForm("ownerFlexibility", e.target.value)} className={cls.input} placeholder="e.g. Negotiable" />
            </div>
          </div>

          {/* Stage + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={cls.label}>Stage</label>
              <select value={form.stage} onChange={(e) => updateForm("stage", e.target.value)} className={`w-full ${cls.select}`}>
                <option value="REVIEW">Review</option>
                <option value="VISIT">Visit</option>
                <option value="NEGOTIATION">Negotiation</option>
                <option value="CLOSED_WON">Closed (Won)</option>
                <option value="CLOSED_LOST">Closed (Lost)</option>
              </select>
            </div>
            <div>
              <label className={cls.label}>Status</label>
              <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className={`w-full ${cls.select}`}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Last Availability Check */}
          <div>
            <label className={cls.label}>Last Availability Check</label>
            <input type="date" value={form.lastAvailabilityCheck} onChange={(e) => updateForm("lastAvailabilityCheck", e.target.value)} className={cls.input} />
          </div>

          {/* Notes */}
          <div>
            <label className={cls.label}>Notes</label>
            <textarea value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} rows={4} className={cls.textarea || cls.input} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button onClick={() => navigate("/acquisitions/land")} className={cls.btnSecondary}>Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className={cls.btnPrimary}>
              {saving ? "Saving…" : isEdit ? "Update Land" : "Create Land"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
