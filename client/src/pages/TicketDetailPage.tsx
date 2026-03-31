import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ticketApi } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import Modal from "../components/ui/Modal";
import {
  TASK_TYPE_LABELS,
  SUB_TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  RECURRING_TYPE_LABELS,
} from "../../../shared/types";
import {
  ArrowLeft,
  Pencil,
  Building2,
  MapPin,
  Calendar,
  Tag,
  Clock,
  MessageSquare,
  Activity,
  Send,
  CheckCircle2,
  Inbox,
  ListChecks,
  UserCircle,
  UserPlus,
} from "lucide-react";

const DAY_NAMES: Record<string, string> = {
  "1": "Monday",
  "2": "Tuesday",
  "3": "Wednesday",
  "4": "Thursday",
  "5": "Friday",
  "6": "Saturday",
  "7": "Sunday",
};

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "activity">(
    "comments"
  );
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchTicket = () => {
    ticketApi
      .getById(id!)
      .then((res) => setTicket(res.data.data))
      .catch(() => toast.error("Failed to load ticket"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const handleStatusChange = async (status: string) => {
    try {
      await ticketApi.updateStatus(id!, status);
      toast.success(`Ticket marked as ${TICKET_STATUS_LABELS[status]}`);
      fetchTicket();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      await ticketApi.addComment(id!, comment.trim());
      setComment("");
      toast.success("Comment added");
      fetchTicket();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSendingComment(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      await ticketApi.update(id!, formData);
      toast.success("Image uploaded");
      fetchTicket();
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const isAssignee = user?.id === ticket?.assignedTo?.id;

  const openAssignModal = async () => {
    try {
      const res = await ticketApi.getAssignableUsers(id!);
      setAssignableUsers(res.data.data);
      setSelectedAssignee(ticket?.assignedTo?.id || "");
      setAssignModalOpen(true);
    } catch {
      toast.error("Failed to load assignable users");
    }
  };

  const handleAssign = async () => {
    if (!selectedAssignee) {
      toast.error("Please select a user");
      return;
    }
    setAssigning(true);
    try {
      await ticketApi.assign(id!, selectedAssignee);
      toast.success("Ticket assigned");
      setAssignModalOpen(false);
      fetchTicket();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to assign ticket";
      toast.error(msg);
    } finally {
      setAssigning(false);
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case "CRITICAL":
        return "bg-red-50 text-red-600";
      case "HIGH":
        return "bg-orange-50 text-orange-600";
      case "MEDIUM":
        return "bg-yellow-50 text-yellow-600";
      case "LOW":
        return "bg-blue-50 text-blue-600";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "OPEN":
        return "bg-blue-50 text-blue-600";
      case "IN_PROGRESS":
        return "bg-yellow-50 text-yellow-600";
      case "COMPLETED":
        return "bg-green-50 text-green-600";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-12 text-center text-gray-500">Ticket not found</div>
    );
  }

  const isOverdue =
    ticket.status !== "COMPLETED" && new Date(ticket.dueDate) < new Date();

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => navigate("/tickets")}
        className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors duration-150"
      >
        <ArrowLeft size={16} />
        Back to Tickets
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{ticket.name}</h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(ticket.status)}`}
            >
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColor(ticket.priority)}`}
            >
              {PRIORITY_LABELS[ticket.priority]}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-primary-600">
            {ticket.ticketNumber}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasPermission(PERMISSIONS.TICKETS.EDIT) && (
            <Link
              to={`/tickets/${ticket.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-white shadow-sm ring-1 ring-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              <Pencil size={16} />
              Edit
            </Link>
          )}
          {hasPermission(PERMISSIONS.TICKETS.ASSIGN) && (
            <button
              onClick={openAssignModal}
              className="inline-flex items-center gap-2 rounded-lg bg-white shadow-sm ring-1 ring-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              <UserPlus size={16} />
              {ticket.assignedTo ? "Reassign" : "Assign"}
            </button>
          )}
          {hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS) && ticket.status !== "COMPLETED" && (
            <button
              onClick={() => handleStatusChange("COMPLETED")}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 shadow-sm transition-all duration-200"
            >
              <CheckCircle2 size={16} />
              Complete
            </button>
          )}
          {ticket.status === "COMPLETED" && hasPermission(PERMISSIONS.TICKETS.REOPEN) && (
            <button
              onClick={() => handleStatusChange("OPEN")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 shadow-sm transition-all duration-200"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
            <h3 className="mb-3 text-[13px] font-semibold text-gray-900">
              Description
            </h3>
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {ticket.description}
            </p>
          </div>

          {/* Image */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
            <h3 className="mb-3 text-[13px] font-semibold text-gray-900">
              Image
            </h3>
            {ticket.imagePath ? (
              <img
                src={`/${ticket.imagePath}`}
                alt="Ticket"
                className="w-full rounded-lg object-cover"
              />
            ) : (
              <p className="text-sm text-gray-400">No image attached</p>
            )}
            {isAssignee && (
              <div className="mt-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {uploadingImage ? "Uploading..." : ticket.imagePath ? "Replace Image" : "Upload Image"}
                </label>
              </div>
            )}
          </div>

          {/* Comments & Activity Tabs */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5">
            <div className="border-b border-gray-200">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab("comments")}
                  className={`flex items-center gap-2 px-6 py-3 text-[13px] font-medium transition-all duration-200 ${
                    activeTab === "comments"
                      ? "border-b-2 border-primary-600 text-primary-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <MessageSquare size={16} />
                  Comments
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {ticket.comments?.length || 0}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("activity")}
                  className={`flex items-center gap-2 px-6 py-3 text-[13px] font-medium transition-all duration-200 ${
                    activeTab === "activity"
                      ? "border-b-2 border-primary-600 text-primary-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Activity size={16} />
                  Activity Log
                </button>
              </nav>
            </div>

            <div className="p-5">
              {activeTab === "comments" && (
                <div>
                  {/* Add comment */}
                  {hasPermission(PERMISSIONS.TICKETS.COMMENT) && (
                    <div className="mb-4 flex gap-2">
                      <input
                        type="text"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={sendingComment || !comment.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 shadow-sm transition-all duration-200"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  )}

                  {/* Comments list */}
                  {ticket.comments?.length === 0 ? (
                    <div className="py-6 text-center">
                      <Inbox size={24} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-400">No comments yet</p>
                      <p className="text-xs text-gray-300">Be the first to add a comment</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ticket.comments?.map((c: any) => (
                        <div
                          key={c.id}
                          className="rounded-lg bg-gray-50/80 ring-1 ring-gray-100 p-3"
                        >
                          <p className="text-sm">{c.content}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(c.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "activity" && (
                <div>
                  {ticket.activities?.length === 0 ? (
                    <div className="py-6 text-center">
                      <ListChecks size={24} className="mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-400">No activity yet</p>
                      <p className="text-xs text-gray-300">Actions will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ticket.activities?.map((a: any) => (
                        <div
                          key={a.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
                          <div>
                            <p className="font-medium text-gray-700">
                              {a.action.replace(/_/g, " ")}
                            </p>
                            {a.details && (
                              <p className="text-gray-500">{a.details}</p>
                            )}
                            <p className="text-xs text-gray-400">
                              {new Date(a.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Sidebar info */}
        <div className="space-y-4">
          {/* Info Card */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
            <h3 className="mb-4 text-[13px] font-semibold text-gray-900">
              Details
            </h3>
            <dl className="space-y-3.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <Building2 size={14} />
                  Property
                </dt>
                <dd>
                  <Link
                    to={`/properties/${ticket.property?.id}`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {ticket.property?.name}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <MapPin size={14} />
                  Unit
                </dt>
                <dd className="font-medium">
                  {ticket.unit?.name}{" "}
                  <span className="text-xs text-gray-400">
                    ({ticket.unit?.code})
                  </span>
                </dd>
              </div>
              {ticket.unit?.floor && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Floor</dt>
                  <dd className="font-medium">{ticket.unit.floor.name}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <Tag size={14} />
                  Category
                </dt>
                <dd className="font-medium">{ticket.category?.name}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Task Type</dt>
                <dd className="font-medium">
                  {TASK_TYPE_LABELS[ticket.taskType]}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Sub Type</dt>
                <dd className="font-medium">
                  {SUB_TASK_TYPE_LABELS[ticket.subTaskType]}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <Calendar size={14} />
                  Due Date
                </dt>
                <dd
                  className={`font-medium ${isOverdue ? "text-red-600" : ""}`}
                >
                  {new Date(ticket.dueDate).toLocaleDateString()}
                  {isOverdue && (
                    <span className="ml-1 text-xs">(Overdue)</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <Clock size={14} />
                  Created
                </dt>
                <dd className="font-medium">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <UserCircle size={14} />
                  Created By
                </dt>
                <dd className="font-medium">
                  {ticket.createdBy
                    ? `${ticket.createdBy.fullName || ticket.createdBy.username} (${ticket.createdBy.role?.name || ""})`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-gray-500">
                  <UserCircle size={14} />
                  Assigned To
                </dt>
                <dd className="font-medium">
                  {ticket.assignedTo
                    ? `${ticket.assignedTo.fullName || ticket.assignedTo.username} (${ticket.assignedTo.role?.name || ""})`
                    : "Unassigned"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Recurring Info */}
          {ticket.isRecurring && (
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
              <h3 className="mb-3 text-[13px] font-semibold text-gray-900">
                Recurring Schedule
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Frequency</span>
                  <span className="font-medium">
                    {RECURRING_TYPE_LABELS[ticket.recurringType]}
                  </span>
                </div>
                {ticket.recurringType === "MONTHLY" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Day of Month</span>
                      <span className="font-medium">{ticket.recurringDay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Due After</span>
                      <span className="font-medium">
                        {ticket.recurringDueDays} days
                      </span>
                    </div>
                  </>
                )}
                {ticket.recurringType === "WEEKLY" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Day of Week</span>
                      <span className="font-medium">
                        {DAY_NAMES[ticket.recurringDay?.toString()] ||
                          ticket.recurringDay}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Due After</span>
                      <span className="font-medium">
                        {ticket.recurringDueDays} days
                      </span>
                    </div>
                  </>
                )}
                {ticket.recurringType === "DAILY" && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Due</span>
                    <span className="font-medium">
                      {ticket.recurringDueDays === 0 ? "Same day" : "Next day"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tagged Assets */}
          {ticket.assets?.length > 0 && (
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-950/5">
              <h3 className="mb-3 text-[13px] font-semibold text-gray-900">
                Tagged Assets
              </h3>
              <div className="space-y-2">
                {ticket.assets.map((ta: any) => (
                  <div
                    key={ta.id}
                    className="flex items-center gap-2 rounded-lg bg-gray-50/80 ring-1 ring-gray-100 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs text-primary-600">
                      {ta.asset.code}
                    </span>
                    <span className="font-medium">{ta.asset.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={ticket.assignedTo ? "Reassign Ticket" : "Assign Ticket"}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Select User
            </label>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select a user...</option>
              {assignableUsers.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.fullName || u.username}
                  {u.role ? ` (${u.role.name})` : ""}
                </option>
              ))}
            </select>
            {assignableUsers.length === 0 && (
              <p className="mt-2 text-xs text-gray-400">
                No users available for assignment.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAssignModalOpen(false)}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={assigning || !selectedAssignee}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-700 disabled:opacity-50"
            >
              {assigning ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
