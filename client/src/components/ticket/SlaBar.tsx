import { useMemo } from "react";

interface SlaBarProps {
  createdAt: string;
  dueDate: string;
  completedAt?: string | null;
  status: string;
}

export default function SlaBar({ createdAt, dueDate, completedAt, status }: SlaBarProps) {
  if (!dueDate) return null;

  const { percentage, label, barColor, textColor, pulsing } = useMemo(() => {
    const created = new Date(createdAt).getTime();
    const due = new Date(dueDate).getTime();
    const totalTime = due - created;

    if (totalTime <= 0) {
      return {
        percentage: 100,
        label: "Invalid SLA window",
        barColor: "bg-gray-300",
        textColor: "text-gray-500",
        pulsing: false,
      };
    }

    const isCompleted = status === "COMPLETED" && completedAt;
    const endTime = isCompleted
      ? new Date(completedAt!).getTime()
      : Date.now();

    const elapsed = endTime - created;
    const pct = Math.min((elapsed / totalTime) * 100, 100);
    const remaining = due - endTime;
    const overdue = endTime > due;

    const formatDuration = (ms: number): string => {
      const abMs = Math.abs(ms);
      const totalMinutes = Math.floor(abMs / (1000 * 60));
      const totalHours = Math.floor(abMs / (1000 * 60 * 60));
      const days = Math.floor(abMs / (1000 * 60 * 60 * 24));

      if (days > 0) return `${days} day${days !== 1 ? "s" : ""}`;
      if (totalHours > 0) return `${totalHours} hour${totalHours !== 1 ? "s" : ""}`;
      return `${totalMinutes} minute${totalMinutes !== 1 ? "s" : ""}`;
    };

    if (isCompleted) {
      if (overdue) {
        return {
          percentage: 100,
          label: `Completed ${formatDuration(endTime - due)} late`,
          barColor: "bg-red-500",
          textColor: "text-red-600",
          pulsing: false,
        };
      }
      return {
        percentage: pct,
        label: "Completed on time",
        barColor: "bg-emerald-500",
        textColor: "text-emerald-600",
        pulsing: false,
      };
    }

    // Not completed
    if (overdue) {
      return {
        percentage: 100,
        label: `${formatDuration(endTime - due)} overdue`,
        barColor: "bg-red-500",
        textColor: "text-red-600",
        pulsing: true,
      };
    }

    // Has time remaining
    const pctUsed = pct;
    let color: string;
    let txt: string;
    if (pctUsed > 90) {
      color = "bg-red-500";
      txt = "text-red-600";
    } else if (pctUsed > 75) {
      color = "bg-amber-500";
      txt = "text-amber-600";
    } else {
      color = "bg-emerald-500";
      txt = "text-emerald-600";
    }

    return {
      percentage: pct,
      label: `${formatDuration(remaining)} remaining`,
      barColor: color,
      textColor: txt,
      pulsing: false,
    };
  }, [createdAt, dueDate, completedAt, status]);

  const formattedDue = new Date(dueDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-100">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Labels */}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">
          Due: {formattedDue}
        </span>
        <span className={`text-[11px] font-medium ${textColor} flex items-center gap-1`}>
          {pulsing && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
            </span>
          )}
          {label}
        </span>
      </div>
    </div>
  );
}
