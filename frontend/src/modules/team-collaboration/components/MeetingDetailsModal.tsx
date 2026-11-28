import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Calendar,
  Clock,
  Edit3,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { TeamMeeting } from "../types";

interface MeetingDetailsModalProps {
  meetingId: string | null;
  onClose: () => void;
  onMeetingUpdated: (m: TeamMeeting) => void;
  onMeetingDeleted: (id: string) => void;
  onEditMeeting?: (m: TeamMeeting) => void;
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-primary-500/20 text-primary-300 border-primary-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

export default function MeetingDetailsModal({
  meetingId,
  onClose,
  onMeetingUpdated,
  onMeetingDeleted,
  onEditMeeting,
}: MeetingDetailsModalProps) {
  const [meeting, setMeeting] = useState<TeamMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const fetchMeeting = useCallback(async () => {
    if (!meetingId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teamApi.getMeetingDetails(meetingId);
      setMeeting(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load meeting details.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void fetchMeeting();
  }, [fetchMeeting]);

  if (!meetingId) return null;

  const handleCancelMeeting = async () => {
    if (!meeting || isCancelling) return;
    setIsCancelling(true);
    try {
      const updated = await teamApi.cancelMeeting(meeting.id);
      setMeeting(updated);
      toast.success("Meeting cancelled.");
      onMeetingUpdated(updated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to cancel meeting.";
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meeting || isDeleting) return;
    setIsDeleting(true);
    try {
      await teamApi.deleteMeeting(meeting.id);
      toast.success("Meeting deleted.");
      onMeetingDeleted(meeting.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete meeting.";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const perms = meeting?.permissions;
  const canEdit = perms?.can_edit && meeting?.status !== "cancelled";
  const canCancel = perms?.can_cancel && meeting?.status === "scheduled";
  const canDelete = perms?.can_delete && meeting?.status !== "completed";

  const isOnline = meeting?.meeting_type === "online";
  const dateFormatted = meeting?.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div className="glass max-w-lg w-full p-6 sm:p-7 bg-dark-800/95 border-white/10 shadow-2xl relative animate-slide-up rounded-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {meeting?.status && (
                <span
                  className={`badge text-[10px] capitalize font-semibold border px-2 py-0.5 ${
                    STATUS_BADGE[meeting.status] || "bg-white/10 text-white"
                  }`}
                >
                  {meeting.status}
                </span>
              )}

              <span
                className={`badge text-[10px] capitalize font-semibold border px-2 py-0.5 ${
                  isOnline
                    ? "bg-primary-500/15 text-primary-300 border-primary-500/30"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}
              >
                {isOnline ? (
                  <span className="flex items-center gap-1">
                    <Video size={10} /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} /> On-Site
                  </span>
                )}
              </span>

              {meeting?.team_name && (
                <span className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 max-w-[140px] truncate">
                  {meeting.team_name}
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white break-words">
              {meeting?.title || "Loading Meeting..."}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Loading / Error states */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-white/50 text-xs">
            <Loader2 size={24} className="animate-spin text-primary-400" />
            <span>Loading meeting schedule...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && meeting && (
          <div className="space-y-4 text-xs">
            {/* Time & Venue Banner */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white/80">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-primary-400 shrink-0" />
                  <span className="font-semibold text-white">{dateFormatted}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60">
                  <Clock size={13} className="text-emerald-400" />
                  <span>
                    {meeting.start_time} - {meeting.end_time} ({meeting.timezone})
                  </span>
                </div>
              </div>

              {/* Online Join Link or Offline Location */}
              {isOnline ? (
                meeting.meeting_link && (
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-white/50 truncate flex items-center gap-1">
                      <Globe size={11} /> {meeting.meeting_link}
                    </span>
                    <a
                      href={meeting.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary text-[11px] py-1.5 px-3 shrink-0 inline-flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Join Meeting
                    </a>
                  </div>
                )
              ) : (
                <div className="pt-2 border-t border-white/5 flex items-center gap-2 text-amber-300/90 font-medium">
                  <MapPin size={13} className="shrink-0 text-amber-400" />
                  <span>{meeting.location || "Venue location not specified"}</span>
                </div>
              )}
            </div>

            {/* Agenda */}
            {meeting.agenda && (
              <div className="space-y-1">
                <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">
                  Agenda & Focus
                </span>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-white/80 leading-relaxed whitespace-pre-wrap">
                  {meeting.agenda}
                </div>
              </div>
            )}

            {/* Description */}
            {meeting.description && (
              <div className="space-y-1">
                <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">
                  Notes & Background
                </span>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-white/70 leading-relaxed whitespace-pre-wrap">
                  {meeting.description}
                </div>
              </div>
            )}

            {/* Attendees & Organizer */}
            <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold flex items-center gap-1.5">
                  <Users size={13} className="text-primary-400" /> Attendees (
                  {meeting.attendee_details.length})
                </span>
                <span className="text-[10px] text-white/40">
                  Organized by: <strong className="text-white">{meeting.organizer_name}</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {meeting.attendee_details.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80 text-[11px]"
                  >
                    <div className="w-4 h-4 rounded-full bg-primary-500/30 text-primary-300 font-bold flex items-center justify-center text-[9px]">
                      {m.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <span>{m.name}</span>
                    {m.role && <span className="text-[9px] text-white/40">({m.role})</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-[10px] text-white/40">
                Created {new Date(meeting.created_at).toLocaleDateString()}
              </span>

              <div className="flex items-center gap-2">
                {canEdit && onEditMeeting && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditMeeting(meeting);
                      onClose();
                    }}
                    className="btn btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                )}

                {canCancel && (
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={handleCancelMeeting}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition inline-flex items-center gap-1"
                  >
                    {isCancelling ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Ban size={12} />
                    )}
                    <span>Cancel Meeting</span>
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition inline-flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmOpen && meeting && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          >
            <div className="glass max-w-sm w-full p-6 bg-dark-800 border-rose-500/30 rounded-2xl space-y-4 shadow-2xl">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={20} />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-white">Delete Meeting?</h4>
                <p className="text-xs text-white/60">
                  Are you sure you want to delete <strong className="text-white">'{meeting.title}'</strong>?
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteMeeting}
                  className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 inline-flex items-center gap-1"
                >
                  {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
