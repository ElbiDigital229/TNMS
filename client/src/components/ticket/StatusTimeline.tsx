import { Check } from "lucide-react";

interface StatusTimelineProps {
  status: string;
  activities: any[];
  createdAt: string;
  completedAt?: string | null;
}

interface Step {
  label: string;
  shortLabel: string;
  state: "completed" | "current" | "future";
  timestamp?: string | null;
}

function formatTimestamp(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const time = d.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return sameYear ? `${month} ${day}, ${time}` : `${month} ${day}, ${d.getFullYear()}`;
}

function findActivityTimestamp(
  activities: any[],
  action: string,
  detailMatch?: string
): string | null {
  // Search in reverse to get the most recent matching activity
  for (let i = activities.length - 1; i >= 0; i--) {
    const a = activities[i];
    if (a.action === action) {
      if (detailMatch && a.details) {
        if (typeof a.details === "string" && a.details.includes(detailMatch)) {
          return a.createdAt;
        }
        if (typeof a.details === "object") {
          const str = JSON.stringify(a.details);
          if (str.includes(detailMatch)) return a.createdAt;
        }
      }
      if (!detailMatch) return a.createdAt;
    }
  }
  return null;
}

const STATUS_ORDER = ["OPEN", "IN_PROGRESS", "COMPLETED"];

function getStatusIndex(status: string): number {
  if (status === "OVERDUE") return 1; // OVERDUE is treated like IN_PROGRESS position
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export default function StatusTimeline({
  status,
  activities,
  createdAt,
  completedAt,
}: StatusTimelineProps) {
  const currentIdx = getStatusIndex(status);
  const isOverdue = status === "OVERDUE";

  // Derive timestamps
  const openTimestamp =
    findActivityTimestamp(activities, "STATUS_CHANGED", "IN_PROGRESS") ||
    findActivityTimestamp(activities, "STATUS_CHANGED", "OPEN") ||
    createdAt;

  const inProgressTimestamp =
    findActivityTimestamp(activities, "STATUS_CHANGED", "IN_PROGRESS") || null;

  const completedTimestamp = completedAt || null;

  const steps: Step[] = [
    {
      label: "Created",
      shortLabel: "Created",
      state: "completed", // always completed
      timestamp: createdAt,
    },
    {
      label: "Open",
      shortLabel: "Open",
      state:
        currentIdx > 0
          ? "completed"
          : currentIdx === 0
          ? "current"
          : "future",
      timestamp: currentIdx >= 0 ? openTimestamp : null,
    },
    {
      label: "In Progress",
      shortLabel: "In Prog.",
      state:
        currentIdx > 1
          ? "completed"
          : currentIdx === 1
          ? "current"
          : "future",
      timestamp: currentIdx >= 1 ? inProgressTimestamp : null,
    },
    {
      label: "Completed",
      shortLabel: "Done",
      state: currentIdx >= 2 ? "completed" : "future",
      timestamp: currentIdx >= 2 ? completedTimestamp : null,
    },
  ];

  return (
    <div className="rounded-lg bg-white ring-1 ring-gray-200 p-3">
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.label} className="flex flex-1 items-start">
            {/* Step column */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              {step.state === "completed" ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 shadow-sm shadow-primary-200">
                  <Check size={12} strokeWidth={3} className="text-white" />
                </div>
              ) : step.state === "current" ? (
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <span
                    className={`absolute inset-0 rounded-full ${
                      isOverdue ? "bg-red-500" : "bg-primary-600"
                    } opacity-20 animate-ping`}
                    style={{ animationDuration: "2s" }}
                  />
                  <span
                    className={`relative block h-3.5 w-3.5 rounded-full border-[2.5px] ${
                      isOverdue
                        ? "border-red-500 bg-red-50"
                        : "border-primary-600 bg-primary-50"
                    }`}
                  />
                </div>
              ) : (
                <div className="flex h-5 w-5 items-center justify-center">
                  <span className="block h-3 w-3 rounded-full border-2 border-gray-300 bg-white" />
                </div>
              )}

              {/* Label + timestamp */}
              <span
                className={`mt-1.5 text-[11px] font-medium leading-tight text-center ${
                  step.state === "current" && isOverdue
                    ? "text-red-600"
                    : step.state === "completed" || step.state === "current"
                    ? "text-gray-700"
                    : "text-gray-400"
                }`}
              >
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.shortLabel}</span>
              </span>
              {step.timestamp && (
                <span className="mt-0.5 text-[10px] leading-tight text-gray-400 text-center">
                  {formatTimestamp(step.timestamp)}
                </span>
              )}
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="flex-1 pt-2.5 px-1.5 sm:px-2">
                <div
                  className={`h-[2px] w-full rounded-full ${
                    step.state === "completed"
                      ? "bg-primary-600"
                      : step.state === "current"
                      ? isOverdue
                        ? "bg-gradient-to-r from-red-400 to-gray-200"
                        : "bg-gradient-to-r from-primary-400 to-gray-200"
                      : "border-t-2 border-dashed border-gray-200 bg-transparent h-0"
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
