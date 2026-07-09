import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ppmApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { cls } from "../lib/styles";
import PageHeader from "../components/ui/PageHeader";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface Step {
  id?: string;
  text: string;
}

export default function PpmFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ text: "" }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    ppmApi.get(id!)
      .then((res) => {
        const p = res.data.data;
        setName(p.name);
        setDescription(p.description || "");
        setSteps(p.steps.length ? p.steps.map((s: Step) => ({ id: s.id, text: s.text })) : [{ text: "" }]);
      })
      .catch(() => toast.error("Failed to load PPM"))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const addStep = () => setSteps((prev) => [...prev, { text: "" }]);
  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx));
  const updateStep = (idx: number, text: string) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, text } : s)));
  const move = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const handlePasteBulk = (raw: string) => {
    // Accept newline- or comma-separated text and turn it into steps.
    // Useful for admins who have the checklist in a spreadsheet already.
    const items = raw
      .split(/\r?\n|,|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length <= 1) return; // fall back to normal typing
    setSteps((prev) => {
      const kept = prev.filter((s) => s.text.trim());
      return [...kept, ...items.map((t) => ({ text: t }))];
    });
  };

  const handleSave = async () => {
    const cleanSteps = steps.map((s) => ({ text: s.text.trim() })).filter((s) => s.text);
    if (!name.trim()) return toast.error("Name is required");
    if (cleanSteps.length === 0) return toast.error("At least one step is required");
    setSaving(true);
    try {
      if (isEdit) {
        await ppmApi.update(id!, { name: name.trim(), description: description.trim() || null, steps: cleanSteps });
        toast.success("PPM updated");
      } else {
        await ppmApi.create({ name: name.trim(), description: description.trim() || null, steps: cleanSteps });
        toast.success("PPM created");
      }
      navigate("/ppm");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-[13px] text-gray-500">Loading…</div>;

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit PPM" : "Create PPM"}
        subtitle="Set the checklist template that techs will run when this PPM ticket is generated"
      />

      <div className="max-w-3xl space-y-4">
        <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200 space-y-3">
          <div>
            <label className={cls.label}>Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cls.input}
              placeholder="e.g. AC Service Checklist"
            />
          </div>
          <div>
            <label className={cls.label}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={cls.textarea}
              placeholder="Optional — describe what this PPM covers"
            />
          </div>
        </div>

        <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-gray-900">Steps</h3>
              <p className="mt-0.5 text-[11px] text-gray-500">Paste a whole checklist into any row (newline/comma separated) and it'll expand into rows.</p>
            </div>
            <span className="text-[11px] text-gray-500">{steps.filter(s => s.text.trim()).length} step{steps.length === 1 ? "" : "s"}</span>
          </div>
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col text-gray-400">
                  <button type="button" onClick={() => move(i, -1)} className="hover:text-gray-700" title="Move up">▲</button>
                  <button type="button" onClick={() => move(i, 1)} className="hover:text-gray-700" title="Move down">▼</button>
                </div>
                <span className={`${cls.mono} w-6 text-[12px] text-gray-400`}>{i + 1}.</span>
                <input
                  type="text"
                  value={s.text}
                  onChange={(e) => updateStep(i, e.target.value)}
                  onPaste={(e) => {
                    const raw = e.clipboardData.getData("text");
                    if (raw && (raw.includes("\n") || raw.includes(","))) {
                      e.preventDefault();
                      handlePasteBulk(raw);
                    }
                  }}
                  placeholder={`Step ${i + 1} — e.g. "Check indoor unit operation"`}
                  className={`${cls.input} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1}
                  className={`${cls.btnIcon} text-red-500 hover:bg-red-50 disabled:opacity-30`}
                  title="Remove step"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className={`${cls.btnSecondary} mt-3`}>
            <Plus size={14} /> Add step
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pb-6">
          <button onClick={() => navigate("/ppm")} className={cls.btnSecondary} disabled={saving}>Cancel</button>
          <button onClick={handleSave} className={cls.btnPrimary} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Update PPM" : "Create PPM"}
          </button>
        </div>
      </div>
    </div>
  );
}
