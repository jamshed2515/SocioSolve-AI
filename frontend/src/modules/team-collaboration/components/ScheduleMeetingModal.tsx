import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Globe,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Users,
  Video,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type {
  CreateMeetingPayload,
  MeetingType,
  TeamMeeting,
  UpdateMeetingPayload,
} from "../types";

interface MemberOption {
  user_id: string;
  name: string;
  role?: string;
}

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  teamId: string;
  teamName: string;
  members: MemberOption[];
  initialMeeting?: TeamMeeting | null;
  onClose: () => void;
  onSuccess: (meeting: TeamMeeting) => void;
}

export default function ScheduleMeetingModal({
  isOpen,
  teamId,
  teamName,
  members,
  initialMeeting,
  onClose,
  onSuccess,
}: ScheduleMeetingModalProps) {
  const isEditing = Boolean(initialMeeting);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("15:00");
  const [timezoneStr, setTimezoneStr] = useState("Asia/Kolkata");
  const [meetingType, setMeetingType] = useState<MeetingType>("online");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("");
  const [agenda, setAgenda] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialMeeting) {
      setTitle(initialMeeting.title || "");
      setDescription(initialMeeting.description || "");
      setMeetingDate(
        initialMeeting.meeting_date ? initialMeeting.meeting_date.substring(0, 10) : ""
      );
      setStartTime(initialMeeting.start_time || "14:00");
      setEndTime(initialMeeting.end_time || "15:00");
      setTimezoneStr(initialMeeting.timezone || "Asia/Kolkata");
      setMeetingType(initialMeeting.meeting_type || "online");
      setMeetingLink(initialMeeting.meeting_link || "");
      setLocation(initialMeeting.location || "");
      setAgenda(initialMeeting.agenda || "");
      setAttendees(initialMeeting.attendees || []);
    } else {
      setTitle("");
      setDescription("");
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setMeetingDate(tomorrow.toISOString().substring(0, 10));
      setStartTime("14:00");
      setEndTime("15:00");
      setTimezoneStr("Asia/Kolkata");
      setMeetingType("online");
      setMeetingLink("");
      setLocation("");
      setAgenda("");
      // Default attendees to all squad members
      setAttendees(members.map((m) => m.user_id));
    }
    setValidationError(null);
  }, [initialMeeting, isOpen, members]);

  if (!isOpen) return null;

  const toggleAttendee = (userId: string) => {
    setAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      setValidationError("Meeting title must be at least 2 characters.");
      return;
    }

    if (!meetingDate) {
      setValidationError("Meeting date is required.");
      return;
    }

    if (endTime.trim() <= startTime.trim()) {
      setValidationError("End time must be later than start time.");
      return;
    }

    if (meetingType === "online" && (!meetingLink || !meetingLink.trim())) {
      setValidationError("Online meetings require a valid meeting link (e.g. Google Meet, Zoom).");
      return;
    }

    if (meetingType === "offline" && (!location || !location.trim())) {
      setValidationError("Offline meetings require a physical meeting location.");
      return;
    }

    setSubmitting(true);
    try {
      const dateIso = new Date(meetingDate).toISOString();

      if (isEditing && initialMeeting) {
        const payload: UpdateMeetingPayload = {
          title: cleanTitle,
          description: description.trim(),
          meeting_date: dateIso,
          start_time: startTime.trim(),
          end_time: endTime.trim(),
          timezone: timezoneStr,
          meeting_type: meetingType,
          meeting_link: meetingType === "online" ? meetingLink.trim() : null,
          location: meetingType === "offline" ? location.trim() : null,
          agenda: agenda.trim(),
          attendees,
        };
        const updated = await teamApi.updateMeeting(initialMeeting.id, payload);
        toast.success("Meeting updated successfully!");
        onSuccess(updated);
      } else {
        const payload: CreateMeetingPayload = {
          title: cleanTitle,
          description: description.trim(),
          meeting_date: dateIso,
          start_time: startTime.trim(),
          end_time: endTime.trim(),
          timezone: timezoneStr,
          meeting_type: meetingType,
          meeting_link: meetingType === "online" ? meetingLink.trim() : null,
          location: meetingType === "offline" ? location.trim() : null,
          agenda: agenda.trim(),
          attendees,
        };
        const created = await teamApi.createMeeting(teamId, payload);
        toast.success("Meeting scheduled successfully!");
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to schedule meeting.";
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div className="glass max-w-lg w-full p-6 sm:p-7 bg-dark-800/95 border-white/10 shadow-2xl relative animate-slide-up rounded-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar size={18} className="text-primary-400" />
              {isEditing ? "Edit Meeting" : "Schedule Team Meeting"}
            </h3>
            <p className="text-xs text-white/50 mt-0.5">Team: {teamName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Meeting Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              placeholder="e.g., Weekly Sprint Sync: Hardware Calibration"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full text-xs py-2.5"
            />
          </div>

          {/* Meeting Type Selection: Online vs Offline */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Meeting Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMeetingType("online")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition ${
                  meetingType === "online"
                    ? "bg-primary-500/20 text-primary-300 border-primary-500/40 ring-1 ring-primary-500/50"
                    : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                <Video size={14} /> Online Conference
              </button>
              <button
                type="button"
                onClick={() => setMeetingType("offline")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition ${
                  meetingType === "offline"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/50"
                    : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                <MapPin size={14} /> In-Person / On-Site
              </button>
            </div>
          </div>

          {/* Link or Location based on type */}
          {meetingType === "online" ? (
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5 flex items-center gap-1">
                <LinkIcon size={12} className="text-primary-400" /> Meeting Link (Google Meet / Zoom / Teams) <span className="text-rose-400">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://meet.google.com/xyz-abcd-efg"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="input w-full text-xs py-2"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5 flex items-center gap-1">
                <MapPin size={12} className="text-amber-400" /> Physical Location / Venue <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., BIT Mesra Incubation Lab, Room 304, Ranchi"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input w-full text-xs py-2"
              />
            </div>
          )}

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1 flex items-center gap-1">
                <Calendar size={11} className="text-primary-400" /> Date
              </label>
              <input
                type="date"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="input w-full text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1 flex items-center gap-1">
                <Clock size={11} className="text-emerald-400" /> Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input w-full text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1 flex items-center gap-1">
                <Clock size={11} className="text-amber-400" /> End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input w-full text-xs py-2"
              />
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1 flex items-center gap-1">
              <Globe size={11} className="text-white/40" /> Timezone
            </label>
            <input
              type="text"
              value={timezoneStr}
              onChange={(e) => setTimezoneStr(e.target.value)}
              className="input w-full text-xs py-1.5 text-white/60"
            />
          </div>

          {/* Agenda & Description */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1">
              Agenda & Topics to Cover
            </label>
            <textarea
              rows={2}
              maxLength={2000}
              placeholder="1. Review telemetry sensor readings&#10;2. Assign Bokaro field test owner"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="input w-full text-xs py-2 resize-none"
            />
          </div>

          {/* Attendees Multi-select */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-primary-400" /> Attendees ({attendees.length})
              </span>
              <span className="text-[10px] text-white/40">Select team participants</span>
            </label>

            <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-white/[0.02] rounded-xl border border-white/10">
              {members.map((m) => {
                const isSelected = attendees.includes(m.user_id);
                return (
                  <div
                    key={m.user_id}
                    onClick={() => toggleAttendee(m.user_id)}
                    className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition text-xs ${
                      isSelected
                        ? "bg-primary-500/20 border border-primary-500/40 text-white"
                        : "hover:bg-white/5 text-white/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-bold text-[9px] text-white shrink-0">
                        {m.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span className="font-medium text-white truncate">{m.name}</span>
                      {m.role && <span className="text-[10px] text-white/40">({m.role})</span>}
                    </div>
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-primary-500 border-primary-400 text-white"
                          : "border-white/20"
                      }`}
                    >
                      {isSelected && <Check size={9} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="btn btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="btn btn-primary text-xs px-5 py-2 inline-flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <span>{isEditing ? "Update Meeting" : "Schedule Meeting"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
