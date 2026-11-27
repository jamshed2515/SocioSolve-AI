import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  Layers,
  Link as LinkIcon,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sliders,
  Target,
  Users,
  Video,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import ScheduleMeetingModal from "../components/ScheduleMeetingModal";
import MeetingDetailsModal from "../components/MeetingDetailsModal";
import CreateMilestoneModal from "../components/CreateMilestoneModal";
import MilestoneDetailsModal from "../components/MilestoneDetailsModal";
import TaskDetailsModal from "../components/TaskDetailsModal";
import type {
  MeetingStatus,
  MeetingType,
  MilestoneStatus,
  Team,
  TeamMeeting,
  TeamMilestone,
} from "../types";

type ViewMode = "my_schedule" | "team_meetings" | "milestones";

const MEETING_STATUS_BADGE: Record<string, { label: string; class: string }> = {
  scheduled: {
    label: "Scheduled",
    class: "bg-primary-500/15 text-primary-300 border-primary-500/30",
  },
  completed: {
    label: "Completed",
    class: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  cancelled: {
    label: "Cancelled",
    class: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
};

const MILESTONE_STATUS_BADGE: Record<
  MilestoneStatus,
  { label: string; class: string }
> = {
  pending: {
    label: "Pending",
    class: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
  in_progress: {
    label: "In Progress",
    class: "bg-primary-500/15 text-primary-300 border-primary-500/30",
  },
  completed: {
    label: "Completed",
    class: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  overdue: {
    label: "Overdue",
    class: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
};

export default function TeamMeetings() {
  const [viewMode, setViewMode] = useState<ViewMode>("my_schedule");

  // Teams state
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Meetings state
  const [meetings, setMeetings] = useState<TeamMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);

  // Milestones state
  const [milestones, setMilestones] = useState<TeamMilestone[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  // Filters
  const [meetingStatusFilter, setMeetingStatusFilter] = useState<string>("all");
  const [upcomingOnly, setUpcomingOnly] = useState<boolean>(false);
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<TeamMeeting | null>(null);

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [isCreateMilestoneModalOpen, setIsCreateMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<TeamMilestone | null>(null);

  // Linked task modal open from milestone
  const [openedTaskId, setOpenedTaskId] = useState<string | null>(null);

  // 1. Fetch user's teams
  useEffect(() => {
    async function loadTeams() {
      setLoadingTeams(true);
      try {
        const res = await teamApi.getMyTeams(1, 50);
        const teams = res.items || [];
        setMyTeams(teams);
        if (teams.length > 0) {
          setSelectedTeamId(teams[0].id);
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load teams.";
        setError(msg);
      } finally {
        setLoadingTeams(false);
      }
    }
    void loadTeams();
  }, []);

  const selectedTeam = myTeams.find((t) => t.id === selectedTeamId);

  // Candidate team members for meeting scheduling
  const teamMemberOptions = React.useMemo(() => {
    if (!selectedTeam) return [];
    const list = [];
    if (selectedTeam.leader_id) {
      list.push({
        user_id: selectedTeam.leader_id,
        name: selectedTeam.leader_name || "Team Leader",
        role: "Leader",
      });
    }
    if (selectedTeam.members) {
      selectedTeam.members.forEach((m) => {
        if (m.user_id !== selectedTeam.leader_id) {
          list.push({
            user_id: m.user_id,
            name: m.name || m.user_id,
            role: m.role || "Member",
          });
        }
      });
    }
    return list;
  }, [selectedTeam]);

  // 2. Fetch Meetings / Milestones based on viewMode
  const fetchData = useCallback(async () => {
    setError(null);

    if (viewMode === "my_schedule") {
      setLoadingMeetings(true);
      try {
        const res = await teamApi.getMyMeetings({
          status: meetingStatusFilter !== "all" ? (meetingStatusFilter as MeetingStatus) : undefined,
          upcoming_only: upcomingOnly,
          limit: 100,
        });
        setMeetings(res.items || []);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load scheduled meetings.";
        setError(msg);
      } finally {
        setLoadingMeetings(false);
      }
    } else if (viewMode === "team_meetings") {
      if (!selectedTeamId) {
        setMeetings([]);
        return;
      }
      setLoadingMeetings(true);
      try {
        const res = await teamApi.getTeamMeetings(selectedTeamId, {
          status: meetingStatusFilter !== "all" ? (meetingStatusFilter as MeetingStatus) : undefined,
          upcoming_only: upcomingOnly,
          limit: 100,
        });
        setMeetings(res.items || []);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load team meetings.";
        setError(msg);
      } finally {
        setLoadingMeetings(false);
      }
    } else if (viewMode === "milestones") {
      if (!selectedTeamId) {
        setMilestones([]);
        return;
      }
      setLoadingMilestones(true);
      try {
        const res = await teamApi.getTeamMilestones(selectedTeamId, {
          status:
            milestoneStatusFilter !== "all"
              ? (milestoneStatusFilter as MilestoneStatus)
              : undefined,
          limit: 100,
        });
        setMilestones(res.items || []);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load team milestones.";
        setError(msg);
      } finally {
        setLoadingMilestones(false);
      }
    }
  }, [
    viewMode,
    selectedTeamId,
    meetingStatusFilter,
    upcomingOnly,
    milestoneStatusFilter,
  ]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Client-side search filtering
  const filteredMeetings = React.useMemo(() => {
    if (!searchQuery.trim()) return meetings;
    const q = searchQuery.toLowerCase();
    return meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.agenda && m.agenda.toLowerCase().includes(q)) ||
        (m.location && m.location.toLowerCase().includes(q))
    );
  }, [meetings, searchQuery]);

  const filteredMilestones = React.useMemo(() => {
    if (!searchQuery.trim()) return milestones;
    const q = searchQuery.toLowerCase();
    return milestones.filter(
      (ms) =>
        ms.title.toLowerCase().includes(q) ||
        (ms.description && ms.description.toLowerCase().includes(q))
    );
  }, [milestones, searchQuery]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-primary-950/40 to-slate-900 border border-white/10 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Phase 7 • Synchronized Execution</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Meetings & Milestones
            </h1>
            <p className="text-sm text-white/60 max-w-2xl leading-relaxed">
              Coordinate team syncs, manage offline/online sessions, and track major project milestones toward Smart India Hackathon and Jharkhand societal goals.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setEditingMeeting(null);
                setIsScheduleModalOpen(true);
              }}
              disabled={!selectedTeamId}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 shadow-lg shadow-primary-500/20 transition-all disabled:opacity-40"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule Sync</span>
            </button>

            <button
              onClick={() => {
                setEditingMilestone(null);
                setIsCreateMilestoneModalOpen(true);
              }}
              disabled={!selectedTeamId}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-40"
            >
              <Target className="w-4 h-4" />
              <span>New Milestone</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Main View Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-white/10 w-fit">
          <button
            onClick={() => setViewMode("my_schedule")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "my_schedule"
                ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>My Schedule</span>
          </button>

          <button
            onClick={() => setViewMode("team_meetings")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "team_meetings"
                ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Team Meetings</span>
          </button>

          <button
            onClick={() => setViewMode("milestones")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "milestones"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Team Milestones</span>
          </button>
        </div>

        {/* Team Dropdown Selector */}
        {viewMode !== "my_schedule" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 font-medium">Team:</span>
            {loadingTeams ? (
              <div className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/40 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading teams...</span>
              </div>
            ) : myTeams.length === 0 ? (
              <span className="text-xs text-rose-400">Not part of any teams</span>
            ) : (
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                {myTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filters */}
          {viewMode !== "milestones" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 font-medium">Status:</span>
              <select
                value={meetingStatusFilter}
                onChange={(e) => setMeetingStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="all">All Meetings</option>
                <option value="scheduled">Scheduled</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-xs text-white/70 hover:text-white">
                <input
                  type="checkbox"
                  checked={upcomingOnly}
                  onChange={(e) => setUpcomingOnly(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-primary-500 focus:ring-0"
                />
                <span>Upcoming only</span>
              </label>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 font-medium">Status:</span>
              <select
                value={milestoneStatusFilter}
                onChange={(e) => setMilestoneStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          )}
        </div>

        {/* Search Input & Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                viewMode === "milestones"
                  ? "Search milestones..."
                  : "Search meetings, agenda..."
              }
              className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <button
            onClick={() => void fetchData()}
            title="Refresh list"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CONTENT: MEETINGS LIST */}
      {viewMode !== "milestones" && (
        <div>
          {loadingMeetings ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
              <p className="text-xs text-white/50">Loading scheduled meetings...</p>
            </div>
          ) : filteredMeetings.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 border border-white/10 rounded-2xl">
              <CalendarClock className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Meetings Scheduled</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto mt-1 mb-5">
                {searchQuery || meetingStatusFilter !== "all"
                  ? "No meetings match your selected filters. Try clearing search criteria."
                  : "No upcoming meetings found for this team. Schedule a team sync to align with your collaborators."}
              </p>
              {selectedTeamId && (
                <button
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary-600 hover:bg-primary-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule Meeting</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMeetings.map((meeting) => {
                const statusStyle =
                  MEETING_STATUS_BADGE[meeting.status] ||
                  MEETING_STATUS_BADGE.scheduled;

                return (
                  <div
                    key={meeting.id}
                    onClick={() => setSelectedMeetingId(meeting.id)}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-primary-500/40 hover:bg-slate-900 transition-all cursor-pointer group flex flex-col justify-between space-y-4 shadow-lg hover:shadow-primary-500/5"
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${statusStyle.class}`}
                          >
                            {statusStyle.label}
                          </span>
                          {meeting.is_upcoming && meeting.status === "scheduled" && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded-full border border-primary-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                              Upcoming
                            </span>
                          )}
                        </div>

                        {/* Format badge */}
                        <span className="text-[10px] font-medium text-white/50 flex items-center gap-1">
                          {meeting.meeting_type === "online" ? (
                            <>
                              <Video className="w-3 h-3 text-primary-400" />
                              <span>Online</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="w-3 h-3 text-amber-400" />
                              <span>Physical</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-bold text-white group-hover:text-primary-300 transition-colors line-clamp-1">
                        {meeting.title}
                      </h3>

                      {/* Description / Agenda */}
                      <p className="text-xs text-white/60 mt-1 line-clamp-2">
                        {meeting.agenda || meeting.description || "No agenda specified."}
                      </p>
                    </div>

                    {/* Time & Venue Info */}
                    <div className="space-y-2 pt-3 border-t border-white/5">
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <Calendar className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                        <span className="font-medium">
                          {new Date(meeting.meeting_date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="text-white/40">•</span>
                        <Clock className="w-3.5 h-3.5 text-primary-400 shrink-0" />
                        <span>
                          {meeting.start_time} - {meeting.end_time}
                        </span>
                      </div>

                      {/* Location / Link preview */}
                      {meeting.meeting_type === "online" && meeting.meeting_link && (
                        <div className="flex items-center gap-1.5 text-xs text-primary-400 truncate">
                          <LinkIcon className="w-3 h-3 shrink-0" />
                          <span className="truncate">{meeting.meeting_link}</span>
                        </div>
                      )}
                      {meeting.meeting_type === "offline" && meeting.location && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-300/80 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{meeting.location}</span>
                        </div>
                      )}

                      {/* Organizer & Attendees */}
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                          <Users className="w-3.5 h-3.5" />
                          <span>{meeting.attendees?.length || 0} attendees</span>
                        </div>

                        {meeting.team_name && (
                          <span className="text-[11px] text-white/40 truncate max-w-[120px]">
                            {meeting.team_name}
                          </span>
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

      {/* CONTENT: MILESTONES LIST */}
      {viewMode === "milestones" && (
        <div>
          {loadingMilestones ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-white/50">Loading team milestones...</p>
            </div>
          ) : filteredMilestones.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/40 border border-white/10 rounded-2xl">
              <Target className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">No Milestones Found</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto mt-1 mb-5">
                {searchQuery || milestoneStatusFilter !== "all"
                  ? "No milestones match your selected filter."
                  : "Set target milestones with due dates and linked tasks to track your team's execution velocity."}
              </p>
              {selectedTeamId && (
                <button
                  onClick={() => setIsCreateMilestoneModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Milestone</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMilestones.map((ms) => {
                const statusStyle =
                  MILESTONE_STATUS_BADGE[ms.status] ||
                  MILESTONE_STATUS_BADGE.pending;

                return (
                  <div
                    key={ms.id}
                    onClick={() => setSelectedMilestoneId(ms.id)}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-amber-500/40 hover:bg-slate-900 transition-all cursor-pointer group flex flex-col justify-between space-y-4 shadow-lg hover:shadow-amber-500/5"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${statusStyle.class}`}
                        >
                          {statusStyle.label}
                        </span>

                        {ms.is_overdue && ms.status !== "completed" && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {ms.title}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-white/60 mt-1 line-clamp-2">
                        {ms.description || "No specific details provided."}
                      </p>
                    </div>

                    {/* Progress Bar & Details */}
                    <div className="space-y-3 pt-3 border-t border-white/5">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-white/60 text-[11px]">Progress</span>
                          <span className="font-mono font-bold text-white">
                            {ms.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              ms.progress >= 100
                                ? "bg-emerald-400"
                                : ms.is_overdue
                                ? "bg-rose-400"
                                : "bg-gradient-to-r from-amber-500 to-amber-400"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, ms.progress))}%` }}
                          />
                        </div>
                      </div>

                      {/* Due date & Linked tasks */}
                      <div className="flex items-center justify-between text-[11px] text-white/50 pt-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            Due:{" "}
                            {new Date(ms.due_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-primary-400" />
                          <span>{ms.linked_task_ids?.length || 0} tasks</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}

      {/* 1. Schedule / Edit Meeting Modal */}
      <ScheduleMeetingModal
        isOpen={isScheduleModalOpen}
        teamId={selectedTeamId}
        teamName={selectedTeam?.name || "Selected Team"}
        members={teamMemberOptions}
        initialMeeting={editingMeeting}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setEditingMeeting(null);
        }}
        onSuccess={(_meeting) => {
          void fetchData();
        }}
      />

      {/* 2. Meeting Details Modal */}
      <MeetingDetailsModal
        meetingId={selectedMeetingId}
        onClose={() => setSelectedMeetingId(null)}
        onMeetingUpdated={(_meeting) => {
          void fetchData();
        }}
        onMeetingCancelled={(_meetingId) => {
          void fetchData();
        }}
        onMeetingDeleted={(_meetingId) => {
          setSelectedMeetingId(null);
          void fetchData();
        }}
        onEditMeeting={(meeting) => {
          setSelectedMeetingId(null);
          setEditingMeeting(meeting);
          setIsScheduleModalOpen(true);
        }}
      />

      {/* 3. Create / Edit Milestone Modal */}
      <CreateMilestoneModal
        isOpen={isCreateMilestoneModalOpen}
        teamId={selectedTeamId}
        teamName={selectedTeam?.name || "Selected Team"}
        initialMilestone={editingMilestone}
        onClose={() => {
          setIsCreateMilestoneModalOpen(false);
          setEditingMilestone(null);
        }}
        onSuccess={(_milestone) => {
          void fetchData();
        }}
      />

      {/* 4. Milestone Details Modal */}
      <MilestoneDetailsModal
        milestoneId={selectedMilestoneId}
        onClose={() => setSelectedMilestoneId(null)}
        onMilestoneUpdated={(_milestone) => {
          void fetchData();
        }}
        onMilestoneDeleted={(_milestoneId) => {
          setSelectedMilestoneId(null);
          void fetchData();
        }}
        onEditMilestone={(ms) => {
          setSelectedMilestoneId(null);
          setEditingMilestone(ms);
          setIsCreateMilestoneModalOpen(true);
        }}
        onOpenTask={(taskId) => {
          setOpenedTaskId(taskId);
        }}
      />

      {/* 5. Linked Task Modal if opened from Milestone */}
      {openedTaskId && (
        <TaskDetailsModal
          taskId={openedTaskId}
          teamMembers={teamMemberOptions}
          onClose={() => setOpenedTaskId(null)}
          onTaskUpdated={(_updatedTask) => {
            void fetchData();
          }}
          onTaskDeleted={(_deletedId) => {
            setOpenedTaskId(null);
            void fetchData();
          }}
        />
      )}
    </div>
  );
}
