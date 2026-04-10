import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ticketApi } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { cls } from "../../lib/styles";
import { StatusBadge, PriorityBadge } from "../ui/Badge";
import { TableLoading, EmptyState } from "../ui/DataTable";
import Modal from "../ui/Modal";
import { ClipboardList, Eye, Trash2 } from "lucide-react";
import { TASK_TYPE_LABELS } from "../../../../shared/types";
import { PERMISSIONS } from "../../../../shared/permissions";

interface Ticket {
  id: string;
  ticketNumber: string;
  name: string;
  status: string;
  priority: string;
  taskType: string;
  dueDate: string | null;
  assignedTo: { id: string; fullName: string | null; username: string } | null;
  unit: { id: string; name: string } | null;
}

interface Props {
  propertyId: string;
}

export default function TicketsTab({ propertyId }: Props) {
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canDelete = hasPermission(PERMISSIONS.TICKETS.DELETE);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Ticket | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTickets = () => {
    setLoading(true);
    ticketApi
      .list({ propertyId, limit: 100 })
      .then((res) => setTickets(res.data.data.data))
      .catch(() => toast.error("Failed to load tickets"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTickets(); }, [propertyId]);

  const handleArchive = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await ticketApi.softDelete(confirmDelete.id);
      toast.success(`${confirmDelete.ticketNumber} archived`);
      setConfirmDelete(null);
      fetchTickets();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to archive ticket");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <TableLoading />;

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={40} />}
        title="No tickets for this property"
        subtitle="Tickets created or imported against this property will appear here."
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className={cls.table}>
          <thead>
            <tr className="border-b border-gray-200">
              <th className={cls.th}>Ticket #</th>
              <th className={cls.th}>Name</th>
              <th className={cls.th}>Type</th>
              <th className={cls.th}>Unit</th>
              <th className={cls.th}>Priority</th>
              <th className={cls.th}>Status</th>
              <th className={cls.th}>Assigned To</th>
              <th className={cls.th}>Due Date</th>
              <th className={cls.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className={cls.tr}>
                <td className={`${cls.td} ${cls.mono}`}>{ticket.ticketNumber}</td>
                <td className={`${cls.td} font-medium text-gray-900`}>{ticket.name}</td>
                <td className={`${cls.td} text-gray-600`}>{TASK_TYPE_LABELS[ticket.taskType] || ticket.taskType}</td>
                <td className={`${cls.td} text-gray-600`}>{ticket.unit?.name || "\u2014"}</td>
                <td className={cls.td}><PriorityBadge priority={ticket.priority} /></td>
                <td className={cls.td}><StatusBadge status={ticket.status} /></td>
                <td className={`${cls.td} text-gray-600`}>
                  {ticket.assignedTo ? (ticket.assignedTo.fullName || ticket.assignedTo.username) : "Unassigned"}
                </td>
                <td className={`${cls.td} text-gray-600`}>
                  {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : "\u2014"}
                </td>
                <td className={cls.td}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/tickets/${ticket.id}`)}
                      className={cls.btnIcon}
                      title="View"
                    >
                      <Eye size={15} />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setConfirmDelete(ticket)}
                        className={`${cls.btnIcon} text-red-600 hover:bg-red-50`}
                        title="Archive"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Archive ticket">
        <p className="text-sm text-gray-600">
          Archive <span className="font-semibold">{confirmDelete?.ticketNumber}</span> — {confirmDelete?.name}? It will be hidden from active views but can be restored later.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirmDelete(null)} className={cls.btnSecondary}>Cancel</button>
          <button onClick={handleArchive} disabled={actionLoading} className={cls.btnDanger}>
            {actionLoading ? "Archiving..." : "Archive"}
          </button>
        </div>
      </Modal>
    </>
  );
}
