import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ticketApi, departmentApi, assetUrl } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { PERMISSIONS } from "../../../shared/permissions";
import Modal from "../components/ui/Modal";
import Lightbox from "../components/ui/Lightbox";
import { cls, STATUS_COLOR, PRIORITY_COLOR } from "../lib/styles";
import { StatusBadge, PriorityBadge } from "../components/ui/Badge";
import SlaBar from "../components/ticket/SlaBar";
import StatusTimeline from "../components/ticket/StatusTimeline";
import RelatedTickets from "../components/ticket/RelatedTickets";
import MentionInput from "../components/ticket/MentionInput";
import { compressImages } from "../lib/compressImage";
import { uploadErrorMessage } from "../lib/uploadError";
import PpmChecklist from "../components/ticket/PpmChecklist";
import { capture } from "../lib/posthog";
import {
  TASK_TYPE_LABELS,
  SUB_TASK_TYPE_LABELS,
  PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  computeUrgency,
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
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCcw,
  Camera,
  MoreHorizontal,
  X,
  Layers,
  ClipboardList,
  Plus,
  Trash2,
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Parse imagePath: handles JSON array, legacy single path, or null */
function parseImagePaths(imagePath: string | null | undefined): string[] {
  if (!imagePath) return [];
  const trimmed = imagePath.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [trimmed];
}

const MAX_IMAGES = 5;


function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function isWithin15Min(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 15 * 60 * 1000;
}

function getInitials(name: string | undefined): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function fmtPdfDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function buildTicketPdf(ticket: any): jsPDF {
  const userName = (u: any) => u?.fullName || u?.username || "—";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  doc.text(ticket.name || "(untitled)", margin, y, { maxWidth: pageWidth - margin * 2 });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(37, 99, 235);
  doc.text(ticket.ticketNumber || "", margin, y);
  y += 14;

  const rows: Array<[string, string]> = [
    ["Status", TICKET_STATUS_LABELS[ticket.status as keyof typeof TICKET_STATUS_LABELS] || ticket.status || "—"],
    ["Priority", PRIORITY_LABELS[ticket.priority as keyof typeof PRIORITY_LABELS] || ticket.priority || "—"],
    ["Task Type", TASK_TYPE_LABELS[ticket.taskType as keyof typeof TASK_TYPE_LABELS] || ticket.taskType || "—"],
    ["Sub Task", SUB_TASK_TYPE_LABELS[ticket.subTaskType as keyof typeof SUB_TASK_TYPE_LABELS] || ticket.subTaskType || "—"],
    ["Category", ticket.category?.name || "—"],
    ["Department", ticket.department?.name || "—"],
    ["Property", ticket.property?.name || "—"],
    ["Unit", ticket.unit?.name || "—"],
    ["Created By", userName(ticket.createdBy)],
    ["Assigned To", ticket.assignedTo ? userName(ticket.assignedTo) : "Unassigned"],
    ["Created", fmtPdfDate(ticket.createdAt)],
    ["Due", fmtPdfDate(ticket.dueDate)],
    ["Completed", fmtPdfDate(ticket.completedAt)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: rows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4, textColor: [17, 24, 39] },
    columnStyles: {
      0: { cellWidth: 110, textColor: [107, 114, 128], fontStyle: "bold" },
      1: { cellWidth: "auto" },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  const sectionHeading = (label: string) => {
    if (y > doc.internal.pageSize.getHeight() - margin - 40) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.text(label.toUpperCase(), margin, y);
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y + 4, pageWidth - margin, y + 4);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
  };

  if (ticket.description) {
    sectionHeading("Description");
    const lines = doc.splitTextToSize(String(ticket.description), pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 8;
  }

  if (Array.isArray(ticket.assets) && ticket.assets.length) {
    sectionHeading("Assets");
    for (const a of ticket.assets) {
      doc.text(`• ${a.name || a.tag || a.id}`, margin, y);
      y += 12;
    }
    y += 6;
  }

  if (Array.isArray(ticket.comments) && ticket.comments.length) {
    sectionHeading(`Comments (${ticket.comments.length})`);
    for (const c of ticket.comments) {
      doc.setFont("helvetica", "bold");
      doc.text(userName(c.user), margin, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(fmtPdfDate(c.createdAt), pageWidth - margin, y, { align: "right" });
      doc.setTextColor(17, 24, 39);
      y += 12;
      const body = doc.splitTextToSize(String(c.content || ""), pageWidth - margin * 2);
      doc.text(body, margin, y);
      y += body.length * 12 + 8;
      if (y > doc.internal.pageSize.getHeight() - margin - 40) {
        doc.addPage();
        y = margin;
      }
    }
  }

  if (Array.isArray(ticket.activities) && ticket.activities.length) {
    sectionHeading("Activity Log");
    for (const a of ticket.activities) {
      const line = `${fmtPdfDate(a.createdAt)} — ${String(a.action || "").replace(/_/g, " ")}${a.user ? ` by ${userName(a.user)}` : ""}`;
      const wrapped = doc.splitTextToSize(line, pageWidth - margin * 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 12;
      if (y > doc.internal.pageSize.getHeight() - margin - 40) {
        doc.addPage();
        y = margin;
      }
    }
  }

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Generated ${new Date().toLocaleString()}    ·    Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" },
    );
  }

  return doc;
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState("");
  const [activeTab, setActiveTab] = useState<"comments" | "activity">(
    "comments"
  );
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<any[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const headerSentinelRef = useRef<HTMLDivElement>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [mentionableUsers, setMentionableUsers] = useState<any[]>([]);

  // Fetch mentionable users once on mount
  useEffect(() => {
    if (!id) return;
    ticketApi
      .getAssignableUsers(id)
      .then((res) => setMentionableUsers(res.data.data))
      .catch(() => {}); // silently fail — mentions just won't autocomplete
  }, [id]);

  // Sticky header — observe when the title area scrolls out of view
  useEffect(() => {
    const sentinel = headerSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyHeader(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-48px 0px 0px 0px" } // h-12 = 48px header
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [ticket]);

  // Block / Unblock state
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [blockDepts, setBlockDepts] = useState<any[]>([]);
  const [blockDeptId, setBlockDeptId] = useState("");
  const [blockDeptUsers, setBlockDeptUsers] = useState<any[]>([]);
  const [blockingUserId, setBlockingUserId] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockingSubmitting, setBlockingSubmitting] = useState(false);
  const [unblockNote, setUnblockNote] = useState("");
  const [unblockSubmitting, setUnblockSubmitting] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

  const handleStatusChange = async (newStatus: string) => {
    const prevTicket = { ...ticket };
    setTicket((prev: any) => ({
      ...prev,
      status: newStatus,
      completedAt: newStatus === "COMPLETED" ? new Date().toISOString() : prev.completedAt,
    }));
    toast.success(`Ticket marked as ${TICKET_STATUS_LABELS[newStatus]}`);
    try {
      await ticketApi.updateStatus(id!, newStatus);
      capture("ticket_status_changed", { ticket_id: id, new_status: newStatus });
      fetchTicket();
    } catch {
      setTicket(prevTicket);
      toast.error("Failed to update status");
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    const commentText = comment.trim();
    const optimisticComment = {
      id: `temp-${Date.now()}`,
      content: commentText,
      createdAt: new Date().toISOString(),
      author: user ? { id: user.id, fullName: user.fullName || user.username, username: user.username } : undefined,
    };
    const prevTicket = { ...ticket, comments: [...(ticket.comments || [])] };
    setTicket((prev: any) => ({
      ...prev,
      comments: [...(prev.comments || []), optimisticComment],
    }));
    setComment("");
    setSendingComment(true);
    toast.success("Comment added");
    try {
      await ticketApi.addComment(id!, commentText);
      fetchTicket();
    } catch {
      setTicket(prevTicket);
      toast.error("Failed to add comment");
    } finally {
      setSendingComment(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return;
    const prevTicket = { ...ticket, comments: [...(ticket.comments || [])] };
    setTicket((prev: any) => ({
      ...prev,
      comments: prev.comments.map((c: any) =>
        c.id === commentId ? { ...c, content: editingCommentContent.trim(), editedAt: new Date().toISOString() } : c
      ),
    }));
    setEditingCommentId(null);
    setEditingCommentContent("");
    try {
      await ticketApi.editComment(id!, commentId, editingCommentContent.trim());
      fetchTicket();
    } catch (err: any) {
      setTicket(prevTicket);
      toast.error(err.response?.data?.error || "Failed to edit comment");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const prevTicket = { ...ticket, comments: [...(ticket.comments || [])] };
    setTicket((prev: any) => ({
      ...prev,
      comments: prev.comments.filter((c: any) => c.id !== commentId),
    }));
    toast.success("Comment deleted");
    try {
      await ticketApi.deleteComment(id!, commentId);
      fetchTicket();
    } catch (err: any) {
      setTicket(prevTicket);
      toast.error(err.response?.data?.error || "Failed to delete comment");
    }
  };

  const handleImageUpload = async (files: FileList | File[]) => {
    const currentImages = parseImagePaths(ticket?.imagePath);
    const remaining = MAX_IMAGES - currentImages.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploadingImage(true);
    try {
      // Downscale first. Production nginx caps the whole request at 10MB and
      // an Android camera photo is routinely 3-6MB, so two straight off the
      // camera would not fit. See lib/compressImage.ts.
      const compressed = await compressImages(toUpload);
      const formData = new FormData();
      compressed.forEach((f) => formData.append("images", f));
      await ticketApi.update(id!, formData);
      toast.success(toUpload.length === 1 ? "Image uploaded" : `${toUpload.length} images uploaded`);
      fetchTicket();
    } catch (err: any) {
      // Say what actually failed. This used to be a bare
      // `catch { toast.error("Failed to upload image") }`, which reported
      // permission errors, oversized files and server faults identically —
      // and is a large part of why the same bug kept being re-reported.
      toast.error(uploadErrorMessage(err));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await ticketApi.softDelete(id!);
      toast.success("Ticket archived");
      navigate("/tickets");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to archive");
    } finally {
      setArchiving(false);
      setConfirmArchiveOpen(false);
    }
  };

  const handleRestore = async () => {
    try {
      await ticketApi.restore(id!);
      toast.success("Ticket restored");
      fetchTicket();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to restore");
    }
  };

  const handleDownload = () => {
    if (!ticket) return;
    try {
      const doc = buildTicketPdf(ticket);
      doc.save(`ticket-${ticket.ticketNumber}.pdf`);
      capture("ticket_downloaded", { ticketId: ticket.id });
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate PDF");
    }
  };

  const handleImageDelete = async (imagePath: string) => {
    try {
      await ticketApi.deleteImage(id!, imagePath);
      toast.success("Image deleted");
      fetchTicket();
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const openBlockModal = async () => {
    try {
      const res = await departmentApi.list();
      setBlockDepts(res.data.data.filter((d: any) => d.status === "ACTIVE"));
      setBlockDeptId("");
      setBlockDeptUsers([]);
      setBlockingUserId("");
      setBlockReason("");
      setBlockModalOpen(true);
    } catch {
      toast.error("Failed to load departments");
    }
  };

  useEffect(() => {
    if (!blockDeptId) { setBlockDeptUsers([]); setBlockingUserId(""); return; }
    departmentApi.getUsers(blockDeptId).then((res) => {
      setBlockDeptUsers(res.data.data);
      setBlockingUserId("");
    }).catch(() => toast.error("Failed to load users"));
  }, [blockDeptId]);

  const handleBlock = async () => {
    if (!blockDeptId || !blockReason.trim()) {
      toast.error("Department and reason are required");
      return;
    }
    setBlockingSubmitting(true);
    try {
      await ticketApi.block(id!, { blockingUserId: blockingUserId || undefined, departmentId: blockDeptId, reason: blockReason.trim() });
      capture("ticket_blocked", { ticket_id: id, department_id: blockDeptId, blocking_user_id: blockingUserId || null });
      toast.success("Ticket blocked — notification sent");
      setBlockModalOpen(false);
      fetchTicket();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to block ticket");
    } finally {
      setBlockingSubmitting(false);
    }
  };

  const handleUnblock = async () => {
    setUnblockSubmitting(true);
    try {
      await ticketApi.unblock(id!, unblockNote.trim() || undefined);
      capture("ticket_unblocked", { ticket_id: id });
      toast.success("Ticket unblocked");
      setUnblockModalOpen(false);
      setUnblockNote("");
      fetchTicket();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to unblock ticket");
    } finally {
      setUnblockSubmitting(false);
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

  const priorityColor = (p: string) => PRIORITY_COLOR[p] || "bg-gray-100 text-gray-600";
  const statusColor = (s: string) => STATUS_COLOR[s] || "bg-gray-100 text-gray-600";

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

  const urgency = computeUrgency(ticket.dueDate, ticket.status);
  const isOverdue = urgency === "OVERDUE";

  return (
    <div className="pb-20 md:pb-0">
      {/* ── Mobile Sticky Collapsed Header ── */}
      <div
        className={`fixed inset-x-0 top-12 z-30 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-4 py-2 transition-all duration-200 md:hidden ${
          showStickyHeader
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate("/tickets")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg active:bg-gray-100"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {ticket.ticketNumber} — {ticket.name}
            </p>
          </div>
          <span className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(ticket.status)}`}>
            {TICKET_STATUS_LABELS[ticket.status]}
          </span>
          <span className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityColor(ticket.priority)}`}>
            {PRIORITY_LABELS[ticket.priority]}
          </span>
        </div>
      </div>

      {/* ── Mobile App Bar (back button) ── */}
      <div className="mb-3 flex items-center gap-3 md:hidden" ref={headerSentinelRef}>
        <button
          onClick={() => navigate("/tickets")}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200"
        >
          <ArrowLeft size={18} className="text-gray-700" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-gray-900">
          {ticket.name}
        </h1>
      </div>

      {/* ── Desktop Breadcrumbs ── */}
      <nav className="mb-4 hidden items-center gap-1.5 text-sm md:flex">
        <Link to="/" className="text-gray-400 hover:text-gray-600 transition-colors">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link to="/tickets" className="text-gray-400 hover:text-gray-600 transition-colors">Tickets</Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-700">{ticket.ticketNumber}</span>
      </nav>

      {/* Header — desktop only shows the full action bar */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <h1 className="hidden text-lg font-semibold text-gray-900 md:block">{ticket.name}</h1>
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

        {/* Desktop action buttons */}
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-lg bg-white shadow-sm ring-1 ring-gray-300 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
            title="Download ticket as PDF"
          >
            <Download size={16} />
            Download
          </button>
          {hasPermission(PERMISSIONS.TICKETS.EDIT) && (
            <Link
              to={`/tickets/${ticket.id}/edit`}
              className="inline-flex items-center gap-2 rounded-lg bg-white shadow-sm ring-1 ring-gray-300 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              <Pencil size={16} />
              Edit
            </Link>
          )}
          {hasPermission(PERMISSIONS.TICKETS.ASSIGN) && (
            <button
              onClick={openAssignModal}
              className="inline-flex items-center gap-2 rounded-lg bg-white shadow-sm ring-1 ring-gray-300 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-all duration-200"
            >
              <UserPlus size={16} />
              {ticket.assignedTo ? "Reassign" : "Assign"}
            </button>
          )}
          {hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS) && ticket.status !== "COMPLETED" && (
            <button
              onClick={() => handleStatusChange("COMPLETED")}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-green-700 shadow-sm transition-all duration-200"
            >
              <CheckCircle2 size={16} />
              Complete
            </button>
          )}
          {ticket.status === "COMPLETED" && hasPermission(PERMISSIONS.TICKETS.REOPEN) && (
            <button
              onClick={() => handleStatusChange(ticket.assignedToId ? "ASSIGNED" : "UNASSIGNED")}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-1.5 text-[13px] font-medium text-primary-700 hover:bg-primary-100 shadow-sm transition-all duration-200"
            >
              Reopen
            </button>
          )}
          {/* Block / Unblock */}
          {ticket.status !== "COMPLETED" && ticket.status !== "BLOCKED" && (isAssignee || hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS)) && (
            <button
              onClick={openBlockModal}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-1.5 text-[13px] font-medium text-orange-700 hover:bg-orange-100 shadow-sm transition-all duration-200 ring-1 ring-orange-200"
            >
              <ShieldAlert size={16} />
              Report Blocker
            </button>
          )}
          {ticket.blocks?.some((b: any) => !b.resolvedAt) && (
            user?.id === ticket.blocks?.[0]?.blockedBy?.id ||
            user?.id === ticket.blocks?.[0]?.blockingUser?.id ||
            hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS)
          ) && (
            <button
              onClick={() => { setUnblockNote(""); setUnblockModalOpen(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-[13px] font-medium text-green-700 hover:bg-green-100 shadow-sm transition-all duration-200 ring-1 ring-green-200"
            >
              <ShieldCheck size={16} />
              Unblock
            </button>
          )}
          {hasPermission(PERMISSIONS.TICKETS.DELETE) && !ticket.deletedAt && (
            <button
              onClick={() => setConfirmArchiveOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-[13px] font-medium text-red-700 hover:bg-red-100 shadow-sm transition-all duration-200 ring-1 ring-red-200"
            >
              <Trash2 size={16} />
              Archive
            </button>
          )}
          {hasPermission(PERMISSIONS.TICKETS.DELETE) && ticket.deletedAt && (
            <button
              onClick={handleRestore}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[13px] font-medium text-emerald-700 hover:bg-emerald-100 shadow-sm transition-all duration-200 ring-1 ring-emerald-200"
            >
              <RotateCcw size={16} />
              Restore
            </button>
          )}
        </div>
      </div>

      {/* Legacy / Archived banner */}
      {(ticket.legacy || ticket.deletedAt) && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-[12px] ${ticket.deletedAt ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
          {ticket.deletedAt && <><strong>Archived</strong> — this ticket is hidden from active views and reports. </>}
          {ticket.legacy && !ticket.deletedAt && <><strong>Legacy</strong> — this is a historical ticket excluded from active workflows and reports.</>}
        </div>
      )}

      {/* Blocked Banner */}
      {ticket.blocks?.some((b: any) => !b.resolvedAt) && ticket.blocks?.[0] && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="mt-0.5 flex-shrink-0 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800">This ticket is blocked</p>
              <p className="mt-1 text-sm text-orange-700">
                <span className="font-medium">Waiting on:</span>{" "}
                {ticket.blocks[0].blockingUser
                  ? `${ticket.blocks[0].blockingUser.fullName || ticket.blocks[0].blockingUser.username} — ${ticket.blocks[0].department?.name}`
                  : ticket.blocks[0].department?.name}
              </p>
              <p className="mt-1 text-sm text-orange-700">
                <span className="font-medium">Reason:</span> {ticket.blocks[0].reason}
              </p>
              <p className="mt-1 text-xs text-orange-500">
                Reported by {ticket.blocks[0].blockedBy?.fullName || ticket.blocks[0].blockedBy?.username} · {new Date(ticket.blocks[0].createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SLA Progress */}
      {ticket.dueDate && (
        <div className="mb-4 rounded-lg bg-white px-4 py-3 ring-1 ring-gray-200">
          <SlaBar
            createdAt={ticket.createdAt}
            dueDate={ticket.dueDate}
            completedAt={ticket.completedAt}
            status={ticket.status}
          />
        </div>
      )}

      {/* Status Timeline */}
      <div className="mb-4">
        <StatusTimeline
          status={ticket.status}
          activities={ticket.activities || []}
          createdAt={ticket.createdAt}
          completedAt={ticket.completedAt}
          dueDate={ticket.dueDate}
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
            <h3 className="mb-3 text-[13px] font-semibold text-gray-900">
              Description
            </h3>
            <p className="whitespace-pre-wrap text-sm text-gray-600">
              {ticket.description}
            </p>
          </div>

          {/* Images Gallery */}
          {(() => {
            const images = parseImagePaths(ticket.imagePath);
            const remaining = MAX_IMAGES - images.length;
            return (
              <div className="rounded-lg bg-white p-4 ring-1 ring-gray-200">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-gray-900">
                    Photos{images.length > 0 && ` (${images.length}/${MAX_IMAGES})`}
                  </h3>
                  {isAssignee && remaining > 0 && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 active:bg-primary-150 transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          if (e.target.files?.length) handleImageUpload(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <Plus size={14} />
                      {uploadingImage ? "Uploading..." : `Add Photo (${images.length}/${MAX_IMAGES})`}
                    </label>
                  )}
                </div>
                {images.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible">
                    {images.map((imgPath, i) => (
                      <div
                        key={imgPath}
                        className="group relative flex-shrink-0 cursor-pointer"
                        onClick={() => setLightboxIndex(i)}
                      >
                        <img
                          src={assetUrl(imgPath)}
                          alt={`Photo ${i + 1}`}
                          className="h-24 w-24 rounded-lg object-cover ring-1 ring-gray-200 transition-shadow hover:ring-primary-300 md:h-32 md:w-full"
                        />
                        {isAssignee && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImageDelete(imgPath);
                            }}
                            className="absolute -right-1.5 -top-1.5 hidden h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600 group-hover:flex transition-colors"
                            title="Delete image"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <label className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-8 transition-colors ${isAssignee ? "hover:border-primary-300 hover:bg-primary-50/30 active:bg-primary-50/50" : ""}`}>
                    {isAssignee && (
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={(e) => {
                          if (e.target.files?.length) handleImageUpload(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    )}
                    <Camera size={24} className="mb-2 text-gray-300" />
                    <p className="text-sm text-gray-400">
                      {isAssignee ? (uploadingImage ? "Uploading..." : "Tap to add photos") : "No images attached"}
                    </p>
                  </label>
                )}
              </div>
            );
          })()}

          {/* PPM Checklist */}
          {ticket.ppm && Array.isArray(ticket.ppmSteps) && ticket.ppmSteps.length > 0 && (
            <PpmChecklist
              ticketId={ticket.id}
              ppmName={ticket.ppm.name}
              steps={ticket.ppmSteps}
              canEdit={isAssignee || hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS)}
              onStepChanged={(updated) => {
                setTicket((prev: any) => prev && ({
                  ...prev,
                  ppmSteps: (prev.ppmSteps || []).map((s: any) => s.id === updated.id ? { ...s, ...updated } : s),
                }));
              }}
            />
          )}

          {/* Comments & Activity Tabs */}
          <div className="rounded-lg bg-white ring-1 ring-gray-200">
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
                      <MentionInput
                        value={comment}
                        onChange={setComment}
                        onSubmit={handleAddComment}
                        placeholder="Add a comment... (type @ to mention)"
                        users={mentionableUsers}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={sendingComment || !comment.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-primary-700 disabled:opacity-50 shadow-sm transition-all duration-200"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  )}

                  {/* Comments list */}
                  {ticket.comments?.length === 0 ? (
                    <p className="py-2 text-center text-sm text-gray-400">No comments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {ticket.comments?.map((c: any) => {
                        const commenterName = c.commenter?.fullName || c.commenter?.username || "System";
                        const isOwn = user && c.commenter?.id === user.id;
                        const canModify = isOwn && isWithin15Min(c.createdAt);
                        const isEditing = editingCommentId === c.id;

                        return (
                          <div
                            key={c.id}
                            className="group rounded-lg bg-gray-50/80 ring-1 ring-gray-100 p-3"
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Initials circle */}
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-600">
                                {getInitials(commenterName)}
                              </div>
                              <div className="min-w-0 flex-1">
                                {/* Header row */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-medium text-gray-800">{commenterName}</span>
                                  <span
                                    className="text-[11px] text-gray-400"
                                    title={new Date(c.createdAt).toLocaleString()}
                                  >
                                    {relativeTime(c.createdAt)}
                                  </span>
                                  {c.editedAt && (
                                    <span
                                      className="text-[11px] italic text-gray-400"
                                      title={`Edited ${new Date(c.editedAt).toLocaleString()}`}
                                    >
                                      (edited)
                                    </span>
                                  )}
                                  {/* Edit / Delete actions */}
                                  {canModify && !isEditing && (
                                    <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => { setEditingCommentId(c.id); setEditingCommentContent(c.content); }}
                                        className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                                        title="Edit comment"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteComment(c.id)}
                                        className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        title="Delete comment"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </span>
                                  )}
                                </div>
                                {/* Content or edit input */}
                                {isEditing ? (
                                  <div className="mt-1.5 flex gap-2">
                                    <input
                                      type="text"
                                      value={editingCommentContent}
                                      onChange={(e) => setEditingCommentContent(e.target.value)}
                                      className="flex-1 rounded-md border border-gray-300 px-2.5 py-1 text-[13px] shadow-sm focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleEditComment(c.id);
                                        if (e.key === "Escape") { setEditingCommentId(null); setEditingCommentContent(""); }
                                      }}
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleEditComment(c.id)}
                                      className="rounded-md bg-primary-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-primary-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => { setEditingCommentId(null); setEditingCommentContent(""); }}
                                      className="rounded-md px-2.5 py-1 text-[12px] font-medium text-gray-500 hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <p className="mt-0.5 text-[13px] text-gray-700">
                                    {c.content.split(/(@[A-Za-z\u00C0-\u024F]+(?: [A-Za-z\u00C0-\u024F]+)?)/g).map((part: string, i: number) =>
                                      part.startsWith("@") ? (
                                        <span key={i} className="text-primary-600 font-medium">{part}</span>
                                      ) : (
                                        <span key={i}>{part}</span>
                                      )
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
                      {ticket.activities?.map((a: any) => {
                        const isBlock = a.action === "BLOCKED";
                        const isUnblock = a.action === "UNBLOCKED";
                        const dotColor = isBlock ? "bg-orange-500" : isUnblock ? "bg-green-500" : "bg-primary-500";
                        return (
                          <div key={a.id} className="flex items-start gap-3 text-sm">
                            <div className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />
                            <div>
                              <p className="font-medium text-gray-700">
                                {a.action.replace(/_/g, " ")}
                                {a.performedBy && (
                                  <span className="ml-1 font-normal text-gray-500">
                                    by {a.performedBy.fullName || a.performedBy.username}
                                  </span>
                                )}
                              </p>
                              {a.details && <p className="text-gray-500">{a.details}</p>}
                              <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Sidebar info */}
        <div className="space-y-3">
          {/* Ticket ID — always at top */}
          <div className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Ticket ID</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono font-semibold text-primary-600">{ticket.ticketNumber}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(ticket.ticketNumber); toast.success("Copied!"); }}
                  className="text-gray-400 hover:text-gray-600"
                  title="Copy ticket number"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
              </span>
            </div>
          </div>

          {/* ── Location Group ── */}
          <div className="rounded-lg bg-white ring-1 ring-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
              <MapPin size={14} className="text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Location</span>
            </div>
            <dl className="space-y-2 p-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Property</dt>
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
                <dt className="text-gray-500">Unit</dt>
                <dd className="font-medium text-gray-900">
                  {ticket.unit?.name}{" "}
                  <span className="text-xs text-gray-400">({ticket.unit?.code})</span>
                </dd>
              </div>
              {ticket.unit?.floor && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Floor</dt>
                  <dd className="font-medium text-gray-900">{ticket.unit.floor.name}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* ── Classification Group ── */}
          <div className="rounded-lg bg-white ring-1 ring-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
              <Tag size={14} className="text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Classification</span>
            </div>
            <dl className="space-y-2 p-3 text-sm">
              {ticket.department && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Department</dt>
                  <dd className="font-medium text-gray-900">{ticket.department.name}</dd>
                </div>
              )}
              {ticket.category && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Category</dt>
                  <dd className="font-medium text-gray-900">{ticket.category.name}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Task Type</dt>
                <dd className="font-medium text-gray-900">{TASK_TYPE_LABELS[ticket.taskType]}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Sub Type</dt>
                <dd className="font-medium text-gray-900">{SUB_TASK_TYPE_LABELS[ticket.subTaskType]}</dd>
              </div>
            </dl>
          </div>

          {/* ── Meta Group ── */}
          <div className="rounded-lg bg-white ring-1 ring-gray-200">
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
              <ClipboardList size={14} className="text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Meta</span>
            </div>
            <dl className="space-y-2 p-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Due Date</dt>
                <dd className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
                  {ticket.dueDate ? (
                    <>
                      {new Date(ticket.dueDate).toLocaleDateString()}
                      {isOverdue && (
                        <span className="ml-1 text-xs">
                          ({Math.ceil((new Date().getTime() - new Date(ticket.dueDate).getTime()) / 86400000)}d overdue)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-gray-900">{new Date(ticket.createdAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Created By</dt>
                <dd className="font-medium text-gray-900">
                  {ticket.createdBy
                    ? `${ticket.createdBy.fullName || ticket.createdBy.username} (${ticket.createdBy.role?.name || ""})`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Assigned To</dt>
                <dd className="font-medium text-gray-900">
                  {ticket.assignedTo
                    ? `${ticket.assignedTo.fullName || ticket.assignedTo.username} (${ticket.assignedTo.role?.name || ""})`
                    : "Unassigned"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Block History */}
          {ticket.blocks?.length > 0 && (
            <div className="rounded-lg bg-white p-3.5 ring-1 ring-gray-200">
              <h3 className="mb-3 text-[13px] font-semibold text-gray-900">Block History</h3>
              <div className="space-y-3">
                {ticket.blocks.map((b: any) => (
                  <div key={b.id} className={`rounded-lg p-3 text-sm ${b.resolvedAt ? "bg-gray-50 ring-1 ring-gray-100" : "bg-orange-50 ring-1 ring-orange-200"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-800">
                        {b.blockingUser
                          ? `${b.blockingUser.fullName || b.blockingUser.username} (${b.department?.name})`
                          : b.department?.name}
                      </span>
                      {b.resolvedAt ? (
                        <span className="text-xs text-green-600 font-medium">Resolved</span>
                      ) : (
                        <span className="text-xs text-orange-600 font-medium">Active</span>
                      )}
                    </div>
                    <p className="mt-1 text-gray-600">"{b.reason}"</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Raised by {b.blockedBy?.fullName || b.blockedBy?.username} · {new Date(b.createdAt).toLocaleDateString()}
                    </p>
                    {b.resolvedAt && (
                      <p className="mt-1 text-xs text-green-700">
                        Resolved by {b.resolvedBy?.fullName || b.resolvedBy?.username} · {new Date(b.resolvedAt).toLocaleDateString()}
                        {b.resolvedNote && ` — "${b.resolvedNote}"`}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tagged Assets */}
          {ticket.assets?.length > 0 && (
            <div className="rounded-lg bg-white p-3.5 ring-1 ring-gray-200">
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

          {/* Related Tickets */}
          <RelatedTickets ticketId={ticket.id} />
        </div>
      </div>

      {/* Block Modal */}
      <Modal isOpen={blockModalOpen} onClose={() => setBlockModalOpen(false)} title="Report Blocker">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Select the department and person who is blocking your progress, then describe what you need.</p>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Department</label>
            <select
              value={blockDeptId}
              onChange={(e) => setBlockDeptId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
            >
              <option value="">Select department...</option>
              {blockDepts.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">
              Person to notify <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={blockingUserId}
              onChange={(e) => setBlockingUserId(e.target.value)}
              disabled={!blockDeptId}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Whole department (no specific person)</option>
              {blockDeptUsers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName || u.username}{u.role ? ` (${u.role.name})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Reason / What you need</label>
            <textarea
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="e.g. Need funds approved to purchase replacement parts..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setBlockModalOpen(false)} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleBlock}
              disabled={blockingSubmitting || !blockDeptId || !blockReason.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition-all duration-200"
            >
              <ShieldAlert size={15} />
              {blockingSubmitting ? "Blocking..." : "Report Blocker"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unblock Modal */}
      <Modal isOpen={unblockModalOpen} onClose={() => setUnblockModalOpen(false)} title="Unblock Ticket">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Confirm you have resolved the blocker. Optionally leave a note (e.g. "Funds approved and transferred").</p>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-gray-700">Resolution note (optional)</label>
            <textarea
              value={unblockNote}
              onChange={(e) => setUnblockNote(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
              placeholder="e.g. Funds approved, transferred to technician..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={() => setUnblockModalOpen(false)} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleUnblock}
              disabled={unblockSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-all duration-200"
            >
              <ShieldCheck size={15} />
              {unblockSubmitting ? "Unblocking..." : "Unblock Ticket"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Assign Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={ticket.assignedTo ? "Reassign Ticket" : "Assign Ticket"}
      >
        <div className="space-y-3">
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

      {/* ── Mobile Bottom Action Bar — sits above the tab bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden"
           style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Primary Action — always present */}
          {(ticket.status === "UNASSIGNED" || ticket.status === "ASSIGNED") && (isAssignee || hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS)) && (
            <button
              onClick={() => handleStatusChange("IN_PROGRESS")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm active:bg-primary-700"
            >
              <Play size={16} />
              Start Work
            </button>
          )}
          {ticket.status === "IN_PROGRESS" && (isAssignee || hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS)) && (
            <button
              onClick={() => handleStatusChange("COMPLETED")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm active:bg-green-700"
            >
              <CheckCircle2 size={16} />
              Mark Completed
            </button>
          )}
          {ticket.status === "COMPLETED" && hasPermission(PERMISSIONS.TICKETS.REOPEN) && (
            <button
              onClick={() => handleStatusChange(ticket.assignedToId ? "ASSIGNED" : "UNASSIGNED")}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm active:bg-primary-700"
            >
              <RotateCcw size={16} />
              Reopen Ticket
            </button>
          )}

          {/* Comment */}
          {hasPermission(PERMISSIONS.TICKETS.COMMENT) && (
            <button
              onClick={() => {
                setActiveTab("comments");
                setTimeout(() => {
                  commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  commentInputRef.current?.focus();
                }, 100);
              }}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200"
            >
              <MessageSquare size={18} />
            </button>
          )}

          {/* More */}
          <button
            onClick={() => setMoreSheetOpen(true)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* ── Mobile "More" Bottom Sheet ── */}
      {moreSheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMoreSheetOpen(false)}
          />
          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-xl animate-slide-up"
               style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <span className="text-sm font-semibold text-gray-900">More Actions</span>
              <button
                onClick={() => setMoreSheetOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-1 p-3">
              {hasPermission(PERMISSIONS.TICKETS.ASSIGN) && (
                <button
                  onClick={() => { setMoreSheetOpen(false); openAssignModal(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 active:bg-gray-100"
                >
                  <UserPlus size={18} className="text-gray-400" />
                  {ticket.assignedTo ? "Reassign Ticket" : "Assign Ticket"}
                </button>
              )}
              {hasPermission(PERMISSIONS.TICKETS.EDIT) && (
                <button
                  onClick={() => { setMoreSheetOpen(false); navigate(`/tickets/${ticket.id}/edit`); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 active:bg-gray-100"
                >
                  <Pencil size={18} className="text-gray-400" />
                  Edit Details
                </button>
              )}
              <button
                onClick={() => { setMoreSheetOpen(false); handleDownload(); }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 active:bg-gray-100"
              >
                <Download size={18} className="text-gray-400" />
                Download Ticket
              </button>
              {isAssignee && parseImagePaths(ticket.imagePath).length < MAX_IMAGES && (
                <label
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 active:bg-gray-100"
                  onClick={() => setMoreSheetOpen(false)}
                >
                  <Camera size={18} className="text-gray-400" />
                  Add Photo ({parseImagePaths(ticket.imagePath).length}/{MAX_IMAGES})
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      if (e.target.files?.length) handleImageUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              {ticket.status !== "COMPLETED" && ticket.status !== "BLOCKED" && (isAssignee || hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS)) && (
                <button
                  onClick={() => { setMoreSheetOpen(false); openBlockModal(); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-orange-700 active:bg-orange-50"
                >
                  <ShieldAlert size={18} className="text-orange-400" />
                  Report Blocker
                </button>
              )}
              {ticket.blocks?.some((b: any) => !b.resolvedAt) && (
                user?.id === ticket.blocks?.[0]?.blockedBy?.id ||
                user?.id === ticket.blocks?.[0]?.blockingUser?.id ||
                hasPermission(PERMISSIONS.TICKETS.UPDATE_STATUS)
              ) && (
                <button
                  onClick={() => { setMoreSheetOpen(false); setUnblockNote(""); setUnblockModalOpen(true); }}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-green-700 active:bg-green-50"
                >
                  <ShieldCheck size={18} className="text-green-400" />
                  Unblock Ticket
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (() => {
        const images = parseImagePaths(ticket.imagePath).map((p: string) => assetUrl(p));
        return (
          <Lightbox
            images={images}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        );
      })()}

      <Modal isOpen={confirmArchiveOpen} onClose={() => setConfirmArchiveOpen(false)} title="Archive ticket">
        <p className="text-[13px] text-gray-600">
          Archive <span className="font-semibold">{ticket.ticketNumber}</span>? It will be hidden from active views and reports but can be restored later.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setConfirmArchiveOpen(false)} className={cls.btnSecondary} disabled={archiving}>Cancel</button>
          <button onClick={handleArchive} className={`${cls.btnPrimary} bg-red-600 hover:bg-red-700`} disabled={archiving}>
            {archiving ? "Archiving..." : "Archive"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
