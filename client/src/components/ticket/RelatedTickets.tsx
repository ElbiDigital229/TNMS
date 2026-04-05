import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ticketApi } from "../../lib/api";
import { StatusBadge } from "../ui/Badge";

interface RelatedTicket {
  id: string;
  ticketNumber: string;
  name: string;
  status: string;
  priority: string;
  createdAt: string;
}

export default function RelatedTickets({ ticketId }: { ticketId: string }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<RelatedTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ticketApi
      .getRelated(ticketId)
      .then((res) => {
        if (!cancelled) setTickets(res.data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setTickets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  return (
    <div className="rounded-lg bg-white ring-1 ring-gray-200 p-3">
      <h3 className="mb-2 text-[13px] font-semibold text-gray-900">
        Related Tickets
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <svg
            className="h-5 w-5 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </div>
      ) : tickets.length === 0 ? (
        <p className="text-[12px] text-gray-400">No related tickets</p>
      ) : (
        <div className="space-y-1.5">
          {tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/tickets/${t.ticketNumber}`)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <span className="shrink-0 font-mono text-[12px] font-medium text-primary-600">
                {t.ticketNumber}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-gray-700">
                {t.name}
              </span>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
