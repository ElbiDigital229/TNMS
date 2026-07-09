import { useMemo, useState } from "react";
import { ppmApi } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { cls } from "../../lib/styles";
import { ListChecks, Check, X, Minus } from "lucide-react";

type Status = "PENDING" | "OK" | "NOT_OK" | "NA";

interface Step {
  id: string;
  order: number;
  text: string;
  status: Status;
  remarks: string | null;
  completedAt: string | null;
  completedBy: { id: string; fullName: string; username: string } | null;
}

interface Props {
  ticketId: string;
  ppmName: string;
  steps: Step[];
  canEdit: boolean;
  onStepChanged: (updated: Step) => void;
}

const STATUS_META: Record<Status, { label: string; className: string; icon: any }> = {
  PENDING: { label: "Pending", className: "bg-gray-100 text-gray-500", icon: Minus },
  OK: { label: "OK", className: "bg-green-100 text-green-700", icon: Check },
  NOT_OK: { label: "Not OK", className: "bg-red-100 text-red-700", icon: X },
  NA: { label: "N/A", className: "bg-gray-100 text-gray-500", icon: Minus },
};

export default function PpmChecklist({ ticketId, ppmName, steps, canEdit, onStepChanged }: Props) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const total = steps.length;
    const ok = steps.filter((s) => s.status === "OK").length;
    const bad = steps.filter((s) => s.status === "NOT_OK").length;
    const na = steps.filter((s) => s.status === "NA").length;
    const done = ok + bad + na;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, ok, bad, na, pct };
  }, [steps]);

  const update = async (step: Step, patch: { status?: Status; remarks?: string }) => {
    setBusyId(step.id);
    try {
      const res = await ppmApi.updateTicketStep(ticketId, step.id, {
        status: patch.status ?? step.status,
        remarks: patch.remarks !== undefined ? patch.remarks : step.remarks ?? "",
      });
      onStepChanged({ ...step, ...res.data.data });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-lg bg-white ring-1 ring-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-primary-600" />
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">PPM Checklist</h3>
            <p className="text-[11px] text-gray-500">{ppmName}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[13px] font-semibold text-gray-800">{summary.done}/{summary.total} · {summary.pct}%</div>
          <div className="text-[10px] text-gray-500">
            {summary.ok} OK · {summary.bad} not OK · {summary.na} N/A
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {steps.map((step) => {
          const meta = STATUS_META[step.status];
          const Icon = meta.icon;
          return (
            <div key={step.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`${cls.mono} text-[11px] text-gray-400`}>{step.order + 1}.</span>
                    <span className="text-[13px] font-medium text-gray-900">{step.text}</span>
                  </div>
                  {step.completedBy && step.completedAt && step.status !== "PENDING" && (
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {meta.label} by {step.completedBy.fullName || step.completedBy.username} · {new Date(step.completedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                  <Icon size={11} strokeWidth={3} />
                  {meta.label}
                </div>
              </div>

              {canEdit ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[auto,1fr]">
                  <div className="inline-flex gap-1">
                    {(["OK", "NOT_OK", "NA"] as Status[]).map((s) => {
                      const isActive = step.status === s;
                      const m = STATUS_META[s];
                      return (
                        <button
                          key={s}
                          onClick={() => update(step, { status: isActive ? "PENDING" : s })}
                          disabled={busyId === step.id}
                          className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${isActive ? m.className + " ring-1 ring-current" : "bg-gray-100 text-gray-600 hover:bg-gray-200"} disabled:opacity-50`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={step.remarks ?? ""}
                    onChange={(e) => onStepChanged({ ...step, remarks: e.target.value })}
                    onBlur={(e) => {
                      if ((step.remarks ?? "") !== e.target.value) return; // stale
                      update(step, { remarks: e.target.value });
                    }}
                    placeholder={step.status === "NOT_OK" ? "Remarks (required for Not OK)" : "Remarks (optional)"}
                    disabled={busyId === step.id}
                    className={`${cls.input} text-[12px]`}
                  />
                </div>
              ) : (
                step.remarks && (
                  <p className="mt-1 text-[12px] text-gray-600">
                    <span className="font-medium">Remarks:</span> {step.remarks}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
