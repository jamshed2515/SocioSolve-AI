import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  Edit3,
  Flag,
  Inbox,
  Layers,
  ListTodo,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Pin,
  Plus,
  Search,
  Send,
  Shield,
  Sliders,
  Tag,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Video,
  MapPin,
  Target,
  Link as LinkIcon,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import EditTeamModal from "../components/EditTeamModal";
import RequestToJoinModal from "../components/RequestToJoinModal";
import InviteMemberModal from "../components/InviteMemberModal";
import CreateDiscussionModal from "../components/CreateDiscussionModal";
import DiscussionThreadView from "../components/DiscussionThreadView";
import CreateTaskModal from "../components/CreateTaskModal";
import TaskDetailsModal from "../components/TaskDetailsModal";
import ScheduleMeetingModal from "../components/ScheduleMeetingModal";
import MeetingDetailsModal from "../components/MeetingDetailsModal";
import CreateMilestoneModal from "../components/CreateMilestoneModal";
import MilestoneDetailsModal from "../components/MilestoneDetailsModal";
import teamApi from "../services/teamApi";
import type {
  AuthUser,
  JoinRequest,
  MeetingStatus,
  MilestoneStatus,
  TaskPriority,
  TaskStatus,
  Team,
  TeamDiscussion,
  TeamMeeting,
  TeamMilestone,
  TeamTask,
} from "../types";

type DetailTab = "overview" | "members" | "requests" | "discussions" | "tasks" | "meetings";

const STATUS_BADGE: Record<string, string> = {
  recruiting: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  full: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  active: "bg-primary-500/20 text-primary-300 border-primary-500/30",
  completed: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

const DISCUSSION_CATEGORIES = [
  "all",
  "General",
  "Ideas",
  "Technical",
  "Resources",
  "Announcements",
  "Questions",
];

const getCategoryClass = (cat: string) => {
  switch (cat?.toLowerCase()) {
    case "announcements":
      return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    case "technical":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
    case "ideas":
      return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    case "resources":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "questions":
      return "bg-rose-500/20 text-rose-300 border-rose-500/30";
    default:
      return "bg-primary-500/20 text-primary-300 border-primary-500/30";
  }
};

const TASK_PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  medium: "bg-primary-500/15 text-primary-300 border-primary-500/30",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  urgent: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  todo: "bg-white/10 text-white/70 border-white/20",
  in_progress: "bg-primary-500/20 text-primary-300 border-primary-500/30",
  review: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

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

export default function TeamDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth() as { user: AuthUser | null };

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  // Edit & Delete modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Join Request states
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCancellingJoin, setIsCancellingJoin] = useState(false);

  // Leader Received Requests state
  const [teamRequests, setTeamRequests] = useState<JoinRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestFilter, setRequestFilter] = useState<string>("pending");
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Phase 4: Invitation & Member Management states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{ user_id: string; name?: string } | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isLeavingTeam, setIsLeavingTeam] = useState(false);
  const [memberToChangeRole, setMemberToChangeRole] = useState<{ user_id: string; name?: string; currentRole: string } | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<string>("Member");
  const [isChangingRole, setIsChangingRole] = useState(false);

  const ASSIGNABLE_ROLES = [
    "Member",
    "Co-Leader",
    "Developer",
    "Researcher",
    "Designer",
    "Domain Expert",
  ];

  // Phase 5: Discussion states
  const [discussions, setDiscussions] = useState<TeamDiscussion[]>([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchDiscQuery, setSearchDiscQuery] = useState("");
  const [isCreateDiscOpen, setIsCreateDiscOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [editingDiscussion, setEditingDiscussion] = useState<TeamDiscussion | null>(null);

  const fetchTeam = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const data = await teamApi.getTeamById(id);
      setTeam(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Team not found or server error.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchTeam();
  }, [fetchTeam]);

  // Load team join requests if leader
  const fetchTeamRequests = useCallback(async () => {
    if (!id) return;
    setLoadingRequests(true);
    try {
      const res = await teamApi.getTeamJoinRequests(id);
      setTeamRequests(res.requests || []);
    } catch {
      // Non-leader or error
    } finally {
      setLoadingRequests(false);
    }
  }, [id]);

  useEffect(() => {
    if (team?.is_leader) {
      void fetchTeamRequests();
    }
  }, [team?.is_leader, fetchTeamRequests]);

  // Phase 5: Load team discussions
  const fetchDiscussions = useCallback(async () => {
    if (!id) return;
    setLoadingDiscussions(true);
    try {
      const res = await teamApi.getTeamDiscussions(id, {
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        search: searchDiscQuery.trim() || undefined,
        limit: 50,
      });
      setDiscussions(res.items || []);
    } catch {
      // Non-member or error
    } finally {
      setLoadingDiscussions(false);
    }
  }, [id, selectedCategory, searchDiscQuery]);

  useEffect(() => {
    if (activeTab === "discussions") {
      void fetchDiscussions();
    }
  }, [activeTab, fetchDiscussions]);

  // Phase 6: Task states
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [searchTaskQuery, setSearchTaskQuery] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>("all");
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>("all");
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  const fetchTeamTasks = useCallback(async () => {
    if (!id) return;
    setLoadingTasks(true);
    try {
      const res = await teamApi.getTeamTasks(id, {
        search: searchTaskQuery.trim() || undefined,
        status: taskStatusFilter !== "all" ? taskStatusFilter : undefined,
        priority: taskPriorityFilter !== "all" ? taskPriorityFilter : undefined,
        assigned_to: taskAssigneeFilter !== "all" ? taskAssigneeFilter : undefined,
        limit: 50,
      });
      setTasks(res.items || []);
    } catch {
      // Non-member or error
    } finally {
      setLoadingTasks(false);
    }
  }, [id, searchTaskQuery, taskStatusFilter, taskPriorityFilter, taskAssigneeFilter]);

  useEffect(() => {
    if (activeTab === "tasks") {
      void fetchTeamTasks();
    }
  }, [activeTab, fetchTeamTasks]);

  // Phase 7: Meetings & Milestones states
  const [meetingSubView, setMeetingSubView] = useState<"meetings" | "milestones">("meetings");
  const [meetings, setMeetings] = useState<TeamMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [meetingStatusFilter, setMeetingStatusFilter] = useState<string>("all");
  const [upcomingOnly, setUpcomingOnly] = useState<boolean>(false);
  const [isScheduleMeetingOpen, setIsScheduleMeetingOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<TeamMeeting | null>(null);

  const [milestones, setMilestones] = useState<TeamMilestone[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<string>("all");
  const [isCreateMilestoneOpen, setIsCreateMilestoneOpen] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<TeamMilestone | null>(null);

  const fetchTeamMeetings = useCallback(async () => {
    if (!id) return;
    setLoadingMeetings(true);
    try {
      const res = await teamApi.getTeamMeetings(id, {
        status: meetingStatusFilter !== "all" ? (meetingStatusFilter as MeetingStatus) : undefined,
        upcoming_only: upcomingOnly,
        limit: 50,
      });
      setMeetings(res.items || []);
    } catch {
      // Non-member or error
    } finally {
      setLoadingMeetings(false);
    }
  }, [id, meetingStatusFilter, upcomingOnly]);

  const fetchTeamMilestones = useCallback(async () => {
    if (!id) return;
    setLoadingMilestones(true);
    try {
      const res = await teamApi.getTeamMilestones(id, {
        status:
          milestoneStatusFilter !== "all"
            ? (milestoneStatusFilter as MilestoneStatus)
            : undefined,
        limit: 50,
      });
      setMilestones(res.items || []);
    } catch {
      // Non-member or error
    } finally {
      setLoadingMilestones(false);
    }
  }, [id, milestoneStatusFilter]);

  useEffect(() => {
    if (activeTab === "meetings") {
      if (meetingSubView === "meetings") {
        void fetchTeamMeetings();
      } else {
        void fetchTeamMilestones();
      }
    }
  }, [activeTab, meetingSubView, fetchTeamMeetings, fetchTeamMilestones]);

  // Handle Team Deletion
  const handleDeleteConfirm = async () => {
    if (!team || isDeleting) return;
    setIsDeleting(true);

    try {
      await teamApi.deleteTeam(team.id);
      toast.success(`Team '${team.name}' was successfully deleted.`);
      navigate("/teams/my-teams");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete team.";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setIsDeleteOpen(false);
    }
  };

  // Handle Cancel Join Request by applicant
  const handleCancelJoinRequest = async () => {
    if (!team?.user_request_id || isCancellingJoin) return;
    setIsCancellingJoin(true);
    try {
      await teamApi.cancelJoinRequest(team.user_request_id);
      toast.success("Join request cancelled.");
      setTeam((prev) =>
        prev
          ? { ...prev, user_request_status: "cancelled", user_request_id: null }
          : null
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to cancel join request.";
      toast.error(msg);
    } finally {
      setIsCancellingJoin(false);
    }
  };

  // Leader Decision on Request
  const handleLeaderDecision = async (
    requestId: string,
    decision: "accepted" | "rejected"
  ) => {
    setDecidingId(requestId);
    try {
      await teamApi.decideJoinRequest(requestId, decision);
      toast.success(
        decision === "accepted"
          ? "Applicant accepted! Member added to the team. 🎉"
          : "Join request rejected."
      );
      // Refresh team details to show updated members and capacity
      await fetchTeam();
      await fetchTeamRequests();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update join request.";
      toast.error(msg);
    } finally {
      setDecidingId(null);
    }
  };

  // Phase 4: Member Removal (Leader only)
  const handleRemoveMemberConfirm = async () => {
    if (!team || !memberToRemove || isRemovingMember) return;
    setIsRemovingMember(true);
    try {
      await teamApi.removeMember(team.id, memberToRemove.user_id);
      toast.success(`${memberToRemove.name || "Member"} was removed from the team.`);
      setMemberToRemove(null);
      await fetchTeam();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to remove member.";
      toast.error(msg);
    } finally {
      setIsRemovingMember(false);
    }
  };

  // Phase 4: Leave Team (Regular member)
  const handleLeaveTeamConfirm = async () => {
    if (!team || isLeavingTeam) return;
    setIsLeavingTeam(true);
    try {
      await teamApi.leaveTeam(team.id);
      toast.success(`You have left '${team.name}'.`);
      setIsLeaveModalOpen(false);
      navigate("/teams/my-teams");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to leave team.";
      toast.error(msg);
      setIsLeavingTeam(false);
    }
  };

  // Phase 4: Change Member Role (Leader only)
  const handleChangeRoleConfirm = async () => {
    if (!team || !memberToChangeRole || isChangingRole) return;
    setIsChangingRole(true);
    try {
      await teamApi.changeMemberRole(team.id, memberToChangeRole.user_id, selectedNewRole);
      toast.success(`Updated role for ${memberToChangeRole.name || "member"} to '${selectedNewRole}'.`);
      setMemberToChangeRole(null);
      await fetchTeam();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update member role.";
      toast.error(msg);
    } finally {
      setIsChangingRole(false);
    }
  };

  if (loading) {
    return (
      <div className="glass p-12 text-center space-y-3">
        <Loader2 size={32} className="animate-spin mx-auto text-primary-400" />
        <h3 className="text-base font-semibold text-white">Loading Team Details...</h3>
        <p className="text-xs text-white/50">Fetching team roster and challenge alignment.</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="glass p-10 text-center space-y-4 border-red-500/30">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-bold text-white">Team Not Found</h3>
        <p className="text-xs text-white/50 max-w-md mx-auto">{error || "This team may have been removed or does not exist."}</p>
        <Link to="/teams/explore" className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Explore Teams
        </Link>
      </div>
    );
  }

  const isLeader =
    team.is_leader ||
    (user?.id && String(user.id) === String(team.leader_id));
  const isMember = team.is_member;
  const isPending = team.user_request_status === "pending";
  const isFull = team.member_count >= (team.max_members || 6) || team.status === "full";
  const canRequestJoin = team.status === "recruiting" && !isFull && !isLeader && !isMember && !isPending;

  const percent = Math.min(
    100,
    Math.round((team.member_count / (team.max_members || 6)) * 100)
  );

  const statusClass =
    STATUS_BADGE[team.status.toLowerCase()] ||
    "bg-white/10 text-white/70 border-white/15";

  const createdDate = new Date(team.created_at).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const pendingRequestsCount = teamRequests.filter((r) => r.status === "pending").length;

  const filteredTeamRequests = teamRequests.filter((r) => {
    if (requestFilter === "all") return true;
    return r.status === requestFilter;
  });

  const teamMemberOptions = [
    ...(team.leader_id
      ? [{ user_id: team.leader_id, name: team.leader_name || "Team Leader", role: "Leader" }]
      : []),
    ...(team.members || [])
      .filter((m) => m.user_id !== team.leader_id)
      .map((m) => ({ user_id: m.user_id, name: m.name || "Member", role: m.role || "Member" })),
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ── Breadcrumb & Top Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/teams/explore"
          className="inline-flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white transition"
        >
          <ArrowLeft size={15} /> Back to Explore Teams
        </Link>

        <div className="flex items-center gap-2">
          {canRequestJoin && (
            <button
              type="button"
              onClick={() => setIsJoinModalOpen(true)}
              className="btn-primary text-xs px-4 py-2 shadow-lg shadow-primary-500/25 flex items-center gap-1.5"
            >
              <Send size={13} />
              <span>Request to Join Team</span>
            </button>
          )}

          {isLeader && (
            <>
              {team.member_count < team.max_members && (
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="btn-primary text-xs px-3.5 py-1.5 shadow-lg shadow-primary-500/25 flex items-center gap-1.5"
                >
                  <UserPlus size={13} />
                  <span>Invite Member</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition"
              >
                <Edit3 size={13} className="text-primary-300" /> Edit Team
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-300 transition"
              >
                <Trash2 size={13} className="text-red-400" /> Delete
              </button>
            </>
          )}

          {isMember && !isLeader && (
            <button
              type="button"
              onClick={() => setIsLeaveModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-300 transition"
            >
              <LogOut size={13} />
              <span>Leave Team</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Pending Request Banner for Applicant ─────────────────────── */}
      {isPending && (
        <div className="glass p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <Clock size={18} className="text-amber-400 shrink-0" />
            <span>
              <strong>Application Pending:</strong> Your request to join this team has been submitted and is awaiting review by the team leader.
            </span>
          </div>
          {team.user_request_id && (
            <button
              type="button"
              disabled={isCancellingJoin}
              onClick={handleCancelJoinRequest}
              className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 font-semibold text-xs transition shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
            >
              {isCancellingJoin ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Cancelling...
                </>
              ) : (
                <>
                  <X size={13} /> Cancel Request
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Team Header Card ────────────────────────────────────────── */}
      <div className="glass p-6 sm:p-8 bg-gradient-to-r from-primary-500/15 via-dark-700/60 to-accent-400/10 border-primary-500/25 rounded-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`badge text-xs font-semibold border ${statusClass} capitalize`}>
                {team.status}
              </span>
              <span className="badge text-xs bg-accent-400/15 text-accent-300 border border-accent-400/25 flex items-center gap-1">
                <Compass size={12} /> {team.challenge_category || "General"}
              </span>
              {isLeader && (
                <span className="badge text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                  <Crown size={12} className="text-amber-400" /> You are Team Leader
                </span>
              )}
              {isMember && !isLeader && (
                <span className="badge text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <CheckCircle2 size={12} className="text-emerald-400" /> You are a Member
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {team.name}
            </h1>

            <p className="text-sm text-accent-300 font-medium flex items-center gap-1.5">
              <Compass size={15} /> {team.challenge_title}
            </p>

            <p className="text-xs sm:text-sm text-white/65 max-w-3xl leading-relaxed">
              {team.description}
            </p>
          </div>

          {/* Quick Roster Stats Widget */}
          <div className="glass p-5 bg-dark-800/80 border-white/10 shrink-0 w-full lg:w-72 space-y-3 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-white/50">
              <span>Team Capacity</span>
              <strong className="text-white font-bold text-sm">
                {team.member_count} / {team.max_members}
              </strong>
            </div>

            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-400 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-white/45">
              <span>Leader: <strong>{team.leader_name}</strong></span>
              <span className="flex items-center gap-1"><Clock size={11} /> {createdDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ─────────────────────────────────────────── */}
      <div className="border-b border-white/10 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "overview"
              ? "border-primary-400 text-primary-300 bg-white/[0.02]"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <Layers size={15} /> Overview
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "members"
              ? "border-primary-400 text-primary-300 bg-white/[0.02]"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          <Users size={15} /> Members ({team.member_count})
        </button>

        {isLeader && (
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "requests"
                ? "border-primary-400 text-primary-300 bg-white/[0.02]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Inbox size={15} /> Join Requests
            {pendingRequestsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("discussions")}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "discussions"
              ? "border-primary-400 text-primary-300 bg-white/[0.02]"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          <MessageSquare size={15} /> Discussions{" "}
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-white/40">Phase 4</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("tasks")}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "tasks"
              ? "border-primary-400 text-primary-300 bg-white/[0.02]"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          <CheckCircle2 size={15} /> Tasks{" "}
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-white/40">Phase 5</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("meetings")}
          className={`px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 shrink-0 ${
            activeTab === "meetings"
              ? "border-primary-400 text-primary-300 bg-white/[0.02]"
              : "border-transparent text-white/40 hover:text-white/70"
          }`}
        >
          <Calendar size={15} /> Meetings & Milestones{" "}
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">Phase 7</span>
        </button>
      </div>

      {/* ── TAB 1: OVERVIEW ─────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Mission Card */}
            <div className="glass p-6 md:col-span-2 space-y-3 rounded-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-accent-400" />
                Team Scope & Mission
              </h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed whitespace-pre-line">
                {team.description}
              </p>
            </div>

            {/* Meta Attributes */}
            <div className="glass p-6 space-y-4 rounded-2xl">
              <h3 className="text-sm font-bold text-white pb-2 border-b border-white/10">
                Governance & Stats
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-white/40 block">Team Lead</span>
                  <span className="font-semibold text-white mt-0.5 block">{team.leader_name}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Status</span>
                  <span className="capitalize font-semibold text-accent-300 mt-0.5 block">{team.status}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Formation Date</span>
                  <span className="text-white/80 mt-0.5 block">{createdDate}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Current Capacity</span>
                  <span className="text-white/80 mt-0.5 block">{team.member_count} of {team.max_members} spots filled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: MEMBERS ROSTER ───────────────────────────────────── */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users size={18} className="text-primary-400" /> Team Roster ({team.members.length})
              </h3>
              <span className="text-xs text-white/45">
                Max capacity: {team.max_members} members ({Math.max(0, team.max_members - team.members.length)} slots open)
              </span>
            </div>

            {isLeader && team.members.length < team.max_members && (
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="btn btn-primary text-xs self-start sm:self-auto flex items-center gap-1.5"
              >
                <UserPlus size={13} /> Invite Member
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.members.map((member) => {
              const isLeaderRole = member.role === "Team Leader" || member.user_id === team.leader_id;
              const joinedDate = new Date(member.joined_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={member.user_id}
                  className={`glass p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                    isLeaderRole
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0 ${
                            isLeaderRole
                              ? "bg-gradient-to-br from-amber-500 to-orange-500"
                              : "bg-gradient-to-br from-primary-500 to-accent-400"
                          }`}
                        >
                          {member.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {member.name || "Team Member"}
                          </p>
                          {member.email && (
                            <p className="text-[11px] text-white/40 truncate mt-0.5">
                              {member.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`badge text-[10px] font-semibold shrink-0 ${
                          isLeaderRole
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-white/5 text-white/70 border border-white/10"
                        }`}
                      >
                        {isLeaderRole && <Crown size={10} className="mr-1 inline text-amber-400" />}
                        {member.role}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between text-[11px] text-white/40">
                      <span>Joined: {joinedDate}</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <UserCheck size={11} /> Active
                      </span>
                    </div>

                    {/* Leader Controls for regular members */}
                    {isLeader && !isLeaderRole && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNewRole(member.role);
                            setMemberToChangeRole({
                              user_id: member.user_id,
                              name: member.name,
                              currentRole: member.role,
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-medium transition flex items-center gap-1"
                        >
                          <Shield size={11} className="text-primary-300" /> Change Role
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMemberToRemove({
                              user_id: member.user_id,
                              name: member.name,
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-[11px] font-medium transition flex items-center gap-1"
                        >
                          <UserMinus size={11} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB: LEADER RECEIVED REQUESTS (PHASE 3) ─────────────────── */}
      {isLeader && activeTab === "requests" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Inbox size={18} className="text-primary-400" /> Received Join Requests
              </h3>
              <p className="text-xs text-white/50">
                Review and approve student applications to join {team.name}.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10 self-start sm:self-auto">
              {(["pending", "all", "accepted", "rejected"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRequestFilter(st)}
                  className={`px-3 py-1 text-xs rounded-lg font-medium transition capitalize ${
                    requestFilter === st
                      ? "bg-primary-500 text-white shadow-sm"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loadingRequests && (
            <div className="glass p-8 text-center space-y-2">
              <Loader2 size={24} className="animate-spin mx-auto text-primary-400" />
              <p className="text-xs text-white/50">Fetching applicant requests...</p>
            </div>
          )}

          {!loadingRequests && filteredTeamRequests.length === 0 && (
            <div className="glass p-10 text-center space-y-3 border-dashed border-white/15 rounded-2xl">
              <Inbox size={28} className="mx-auto text-white/30" />
              <h4 className="text-sm font-semibold text-white">No Join Requests</h4>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                {requestFilter === "pending"
                  ? "There are currently no pending join requests for this team."
                  : `No requests match the '${requestFilter}' filter.`}
              </p>
            </div>
          )}

          {!loadingRequests && filteredTeamRequests.length > 0 && (
            <div className="space-y-3.5">
              {filteredTeamRequests.map((req) => {
                const appliedDate = new Date(req.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });
                const isDeciding = decidingId === req.id;
                const isPendingReq = req.status === "pending";

                return (
                  <div
                    key={req.id}
                    className="glass p-5 rounded-2xl border border-white/10 space-y-4 hover:border-white/20 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Applicant Profile */}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center font-bold text-white text-sm shrink-0">
                          {req.applicant_name?.[0]?.toUpperCase() || "A"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-white">
                              {req.applicant_name || "Applicant"}
                            </h4>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/60 capitalize font-medium">
                              {req.applicant_role || "Student"}
                            </span>
                          </div>
                          {req.applicant_email && (
                            <p className="text-xs text-white/45">{req.applicant_email}</p>
                          )}
                        </div>
                      </div>

                      {/* Status / Actions */}
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="text-[11px] text-white/40 mr-1 flex items-center gap-1">
                          <Calendar size={11} /> {appliedDate}
                        </span>

                        {isPendingReq ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isDeciding || isFull}
                              onClick={() => handleLeaderDecision(req.id, "accepted")}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
                              title={isFull ? "Team capacity reached" : "Accept applicant"}
                            >
                              {isDeciding ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                              <span>{isFull ? "Team Full" : "Accept"}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isDeciding}
                              onClick={() => handleLeaderDecision(req.id, "rejected")}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition flex items-center gap-1 disabled:opacity-50"
                            >
                              <X size={13} />
                              <span>Reject</span>
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`badge text-xs capitalize font-semibold border ${
                              req.status === "accepted"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : req.status === "rejected"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                                : "bg-white/10 text-white/60 border-white/15"
                            }`}
                          >
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Applicant Skills */}
                    {req.applicant_skills && req.applicant_skills.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-white/40 mr-1">Skills:</span>
                        {req.applicant_skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-accent-300 font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Note / Message */}
                    {req.message && (
                      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/70 italic leading-relaxed">
                        &ldquo;{req.message}&rdquo;
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: DISCUSSIONS (PHASE 5) ─────────────────────────────── */}
      {activeTab === "discussions" && (
        <div className="space-y-4">
          {!isMember && !isLeader ? (
            <div className="glass p-10 text-center rounded-2xl border border-white/10 space-y-3">
              <Shield size={32} className="mx-auto text-amber-400" />
              <h3 className="text-base font-bold text-white">Private Team Discussions</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto">
                Discussions and threads are restricted to official squad members of {team.name}. Join the team to view and participate in discussions.
              </p>
              {team.user_request_status !== "pending" && !isFull && (
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2"
                >
                  <UserPlus size={14} /> Request to Join Team
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Discussion Controls Header */}
              <div className="glass p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <MessageSquare size={16} className="text-primary-400" />
                      Team Discussions ({discussions.length})
                    </h3>
                    <p className="text-xs text-white/45 mt-0.5">
                      Share ideas, technical approaches, resources, and announcements.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDiscussion(null);
                      setIsCreateDiscOpen(true);
                    }}
                    className="btn btn-primary text-xs self-start sm:self-auto flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Start Discussion
                  </button>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search discussions by title or content..."
                      value={searchDiscQuery}
                      onChange={(e) => setSearchDiscQuery(e.target.value)}
                      className="input pl-9 text-xs py-2 w-full"
                    />
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/5 overflow-x-auto">
                  {DISCUSSION_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition capitalize whitespace-nowrap ${
                        selectedCategory === cat
                          ? "bg-primary-500 text-white shadow-sm"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {cat === "all" ? "All Categories" : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {loadingDiscussions && (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="glass p-5 rounded-2xl border border-white/10 animate-pulse space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-4 bg-white/10 rounded w-1/3" />
                        <div className="h-4 bg-white/10 rounded w-20" />
                      </div>
                      <div className="h-3 bg-white/10 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!loadingDiscussions && discussions.length === 0 && (
                <div className="glass p-10 text-center rounded-2xl border border-white/10 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 text-white/40 flex items-center justify-center mx-auto">
                    <MessageSquare size={24} />
                  </div>
                  <h4 className="text-sm font-semibold text-white">No discussions found</h4>
                  <p className="text-xs text-white/40 max-w-sm mx-auto">
                    {searchDiscQuery || selectedCategory !== "all"
                      ? "No discussions match your filter criteria."
                      : `No discussions have been posted in ${team.name} yet. Start the dialogue!`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDiscussion(null);
                      setIsCreateDiscOpen(true);
                    }}
                    className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2"
                  >
                    <Plus size={14} /> Start First Discussion
                  </button>
                </div>
              )}

              {/* Discussions List */}
              {!loadingDiscussions && discussions.length > 0 && (
                <div className="space-y-3">
                  {discussions.map((disc) => {
                    const dateStr = new Date(disc.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={disc.id}
                        onClick={() => setActiveThreadId(disc.id)}
                        className={`glass p-5 rounded-2xl border transition-all cursor-pointer hover:border-primary-500/40 hover:bg-white/[0.04] space-y-3 ${
                          disc.is_pinned
                            ? "border-amber-500/30 bg-amber-500/[0.02]"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`badge text-[10px] font-semibold border ${getCategoryClass(disc.category)} capitalize`}>
                              <Tag size={10} className="mr-1 inline" /> {disc.category}
                            </span>
                            {disc.is_pinned && (
                              <span className="badge text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                                <Pin size={10} className="text-amber-400" /> Pinned
                              </span>
                            )}
                            {disc.is_locked && (
                              <span className="badge text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-semibold">
                                <Lock size={10} className="text-rose-400" /> Locked
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-white/40 flex items-center gap-1">
                            <Clock size={11} /> {dateStr}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-primary-300 transition">
                            {disc.title}
                          </h4>
                          <p className="text-xs text-white/60 line-clamp-2 mt-1 leading-relaxed">
                            {disc.content}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-white/50">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-300 font-bold flex items-center justify-center text-[10px]">
                              {disc.author_name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <span className="text-[11px] text-white/70 font-medium">
                              {disc.author_name || "Team Member"}
                            </span>
                            {disc.is_author_leader && (
                              <span className="badge text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                                <Crown size={9} /> Leader
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-white/50">
                            <MessageSquare size={13} className="text-primary-400" />
                            <span>{disc.comment_count || 0} {disc.comment_count === 1 ? "comment" : "comments"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 4: TASKS (PHASE 6) ──────────────────────────────────── */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {!isMember && !isLeader ? (
            <div className="glass p-10 text-center rounded-2xl border border-white/10 space-y-3">
              <Shield size={32} className="mx-auto text-amber-400" />
              <h3 className="text-base font-bold text-white">Private Team Tasks</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto">
                Tasks, deadlines, and sprint tracking are restricted to official squad members of {team.name}.
              </p>
              {team.user_request_status !== "pending" && !isFull && (
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2"
                >
                  <UserPlus size={14} /> Request to Join Team
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Task Header & Controls */}
              <div className="glass p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ListTodo size={16} className="text-primary-400" />
                      Team Tasks & Deliverables ({tasks.length})
                    </h3>
                    <p className="text-xs text-white/45 mt-0.5">
                      Organize sprint responsibilities, track progress, and monitor deadlines.
                    </p>
                  </div>

                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask(null);
                        setIsCreateTaskOpen(true);
                      }}
                      className="btn btn-primary text-xs self-start sm:self-auto flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Create Task
                    </button>
                  )}
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      placeholder="Search tasks by title..."
                      value={searchTaskQuery}
                      onChange={(e) => setSearchTaskQuery(e.target.value)}
                      className="input pl-9 text-xs py-2 w-full"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-white/50 flex items-center gap-1">
                      <Flag size={12} /> Priority:
                    </span>
                    <select
                      value={taskPriorityFilter}
                      onChange={(e) => setTaskPriorityFilter(e.target.value)}
                      className="input py-1 px-2 text-xs bg-dark-800 text-white border-white/15 rounded-lg"
                    >
                      <option value="all">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-white/50 flex items-center gap-1">
                      <Users size={12} /> Assignee:
                    </span>
                    <select
                      value={taskAssigneeFilter}
                      onChange={(e) => setTaskAssigneeFilter(e.target.value)}
                      className="input py-1 px-2 text-xs bg-dark-800 text-white border-white/15 rounded-lg max-w-[130px] truncate"
                    >
                      <option value="all">All Members</option>
                      {teamMemberOptions.map((m) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-white/5 overflow-x-auto">
                  {[
                    { value: "all", label: "All Tasks" },
                    { value: "todo", label: "To Do" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "review", label: "In Review" },
                    { value: "completed", label: "Completed" },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setTaskStatusFilter(tab.value)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition whitespace-nowrap ${
                        taskStatusFilter === tab.value
                          ? "bg-primary-500 text-white shadow-sm"
                          : "text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Loading State */}
              {loadingTasks && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((n) => (
                    <div key={n} className="glass p-5 rounded-2xl border border-white/10 animate-pulse space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-4 bg-white/10 rounded w-1/3" />
                        <div className="h-4 bg-white/10 rounded w-16" />
                      </div>
                      <div className="h-3 bg-white/10 rounded w-3/4" />
                      <div className="h-2 bg-white/10 rounded w-full" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!loadingTasks && tasks.length === 0 && (
                <div className="glass p-10 text-center rounded-2xl border border-white/10 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 text-white/40 flex items-center justify-center mx-auto">
                    <ListTodo size={24} />
                  </div>
                  <h4 className="text-sm font-semibold text-white">No tasks found</h4>
                  <p className="text-xs text-white/40 max-w-sm mx-auto">
                    {searchTaskQuery || taskStatusFilter !== "all" || taskPriorityFilter !== "all" || taskAssigneeFilter !== "all"
                      ? "No tasks match your selected filter criteria."
                      : `No tasks have been created for ${team.name} yet.`}
                  </p>
                  {isLeader && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTask(null);
                        setIsCreateTaskOpen(true);
                      }}
                      className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2"
                    >
                      <Plus size={14} /> Create First Task
                    </button>
                  )}
                </div>
              )}

              {/* Tasks Grid */}
              {!loadingTasks && tasks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tasks.map((t) => {
                    const hasOverdue = t.is_overdue;
                    const dueDateFormatted = t.due_date
                      ? new Date(t.due_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No deadline";

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className={`glass p-5 rounded-2xl border transition-all cursor-pointer hover:border-primary-500/40 hover:bg-white/[0.04] space-y-3.5 relative overflow-hidden group ${
                          t.status === "completed"
                            ? "border-emerald-500/20 bg-emerald-500/[0.01]"
                            : hasOverdue
                            ? "border-rose-500/30 bg-rose-500/[0.02]"
                            : "border-white/10 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`badge text-[10px] uppercase font-bold border px-2 py-0.5 ${
                                TASK_PRIORITY_BADGE[t.priority] || "bg-white/10 text-white"
                              }`}
                            >
                              <Flag size={9} className="mr-1 inline" /> {t.priority}
                            </span>

                            <span
                              className={`badge text-[10px] capitalize font-semibold border px-2 py-0.5 ${
                                TASK_STATUS_BADGE[t.status] || "bg-white/10 text-white"
                              }`}
                            >
                              {t.status.replace("_", " ")}
                            </span>

                            {hasOverdue && (
                              <span className="badge text-[10px] bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold flex items-center gap-1">
                                <AlertCircle size={10} /> Overdue
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[11px] flex items-center gap-1 ${
                              hasOverdue ? "text-rose-400 font-bold" : "text-white/40"
                            }`}
                          >
                            <Clock size={11} className={hasOverdue ? "text-rose-400" : "text-amber-400"} />
                            {dueDateFormatted}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-primary-300 transition">
                            {t.title}
                          </h4>
                          {t.description && (
                            <p className="text-xs text-white/60 line-clamp-2 mt-1 leading-relaxed">
                              {t.description}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-white/40">Progress</span>
                            <span className="font-mono font-semibold text-white/80">{t.progress}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                t.progress === 100
                                  ? "bg-emerald-500"
                                  : t.progress > 50
                                  ? "bg-primary-500"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                          <span className="text-[10px] text-white/40">
                            By {t.creator_name || "Leader"}
                          </span>

                          <div className="flex items-center -space-x-1.5">
                            {t.assigned_members.slice(0, 3).map((m) => (
                              <div
                                key={m.id}
                                title={m.name}
                                className="w-5 h-5 rounded-full bg-primary-500/40 border border-dark-900 text-primary-200 font-bold flex items-center justify-center text-[9px]"
                              >
                                {m.name?.[0]?.toUpperCase() || "U"}
                              </div>
                            ))}
                            {t.assigned_members.length > 3 && (
                              <div className="w-5 h-5 rounded-full bg-white/10 border border-dark-900 text-white/60 font-semibold flex items-center justify-center text-[9px]">
                                +{t.assigned_members.length - 3}
                              </div>
                            )}
                            {t.assigned_members.length === 0 && (
                              <span className="text-[10px] text-white/30 italic">Unassigned</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 5: MEETINGS & MILESTONES (PHASE 7) ──────────────────── */}
      {activeTab === "meetings" && (
        <div className="space-y-4">
          {!isMember && !isLeader ? (
            <div className="glass p-10 text-center rounded-2xl border border-white/10 space-y-3">
              <Shield size={32} className="mx-auto text-amber-400" />
              <h3 className="text-base font-bold text-white">Private Team Syncs & Milestones</h3>
              <p className="text-xs text-white/50 max-w-md mx-auto">
                Meeting links, physical sync venues, and delivery milestones are restricted to members of {team.name}.
              </p>
              {team.user_request_status !== "pending" && !isFull && (
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2"
                >
                  <UserPlus size={14} /> Request to Join Team
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Sub-view toggle & Controls */}
              <div className="glass p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 bg-dark-900/60 p-1 rounded-xl border border-white/10 w-fit">
                    <button
                      type="button"
                      onClick={() => setMeetingSubView("meetings")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        meetingSubView === "meetings"
                          ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <Calendar size={13} />
                      <span>Meetings ({meetings.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeetingSubView("milestones")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        meetingSubView === "milestones"
                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                          : "text-white/60 hover:text-white"
                      }`}
                    >
                      <Target size={13} />
                      <span>Milestones ({milestones.length})</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {meetingSubView === "meetings" ? (
                      isLeader && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMeeting(null);
                            setIsScheduleMeetingOpen(true);
                          }}
                          className="btn-primary text-xs px-3.5 py-1.5 shadow-lg shadow-primary-500/20 flex items-center gap-1.5"
                        >
                          <Plus size={14} /> Schedule Sync
                        </button>
                      )
                    ) : (
                      isLeader && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMilestone(null);
                            setIsCreateMilestoneOpen(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/20 transition flex items-center gap-1.5"
                        >
                          <Plus size={14} /> New Milestone
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Filters */}
                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-3">
                  {meetingSubView === "meetings" ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50">Status:</span>
                        <select
                          value={meetingStatusFilter}
                          onChange={(e) => setMeetingStatusFilter(e.target.value)}
                          className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                        >
                          <option value="all" className="bg-dark-900">All</option>
                          <option value="scheduled" className="bg-dark-900">Scheduled</option>
                          <option value="completed" className="bg-dark-900">Completed</option>
                          <option value="cancelled" className="bg-dark-900">Cancelled</option>
                        </select>
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-white/70 hover:text-white">
                        <input
                          type="checkbox"
                          checked={upcomingOnly}
                          onChange={(e) => setUpcomingOnly(e.target.checked)}
                          className="rounded border-white/20 bg-white/5 text-primary-500 focus:ring-0"
                        />
                        <span>Upcoming only</span>
                      </label>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50">Status:</span>
                      <select
                        value={milestoneStatusFilter}
                        onChange={(e) => setMilestoneStatusFilter(e.target.value)}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                      >
                        <option value="all" className="bg-dark-900">All Statuses</option>
                        <option value="pending" className="bg-dark-900">Pending</option>
                        <option value="in_progress" className="bg-dark-900">In Progress</option>
                        <option value="completed" className="bg-dark-900">Completed</option>
                        <option value="overdue" className="bg-dark-900">Overdue</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-view Content: Meetings */}
              {meetingSubView === "meetings" && (
                <>
                  {loadingMeetings ? (
                    <div className="glass p-12 text-center rounded-2xl space-y-2">
                      <Loader2 size={24} className="animate-spin mx-auto text-primary-400" />
                      <p className="text-xs text-white/50">Loading scheduled meetings...</p>
                    </div>
                  ) : meetings.length === 0 ? (
                    <div className="glass p-10 text-center rounded-2xl border-dashed border-white/15 space-y-3">
                      <Calendar size={28} className="mx-auto text-white/20" />
                      <h4 className="text-sm font-bold text-white">No Meetings Found</h4>
                      <p className="text-xs text-white/50 max-w-sm mx-auto">
                        No team meetings currently match the selected criteria.
                      </p>
                      {isLeader && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMeeting(null);
                            setIsScheduleMeetingOpen(true);
                          }}
                          className="btn-primary text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5"
                        >
                          <Plus size={13} /> Schedule Sync
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {meetings.map((m) => {
                        const statusStyle =
                          MEETING_STATUS_BADGE[m.status] || MEETING_STATUS_BADGE.scheduled;

                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMeetingId(m.id)}
                            className="glass p-5 rounded-2xl hover:border-primary-500/40 transition cursor-pointer group flex flex-col justify-between space-y-3"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`badge text-[10px] font-semibold border ${statusStyle.class}`}
                                  >
                                    {statusStyle.label}
                                  </span>
                                  {m.is_upcoming && m.status === "scheduled" && (
                                    <span className="badge text-[10px] bg-primary-500/10 text-primary-300 border-primary-500/20 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                                      Upcoming
                                    </span>
                                  )}
                                </div>

                                <span className="text-[10px] text-white/50 flex items-center gap-1">
                                  {m.meeting_type === "online" ? (
                                    <>
                                      <Video size={12} className="text-primary-400" /> Online
                                    </>
                                  ) : (
                                    <>
                                      <MapPin size={12} className="text-amber-400" /> Physical
                                    </>
                                  )}
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-white group-hover:text-primary-300 transition line-clamp-1">
                                {m.title}
                              </h4>
                              {m.description && (
                                <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                                  {m.description}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2 pt-2 border-t border-white/5 text-xs text-white/70">
                              <div className="flex items-center gap-2">
                                <Clock size={12} className="text-primary-400 shrink-0" />
                                <span className="truncate">
                                  {new Date(m.meeting_date).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}{" "}
                                  • {m.start_time} - {m.end_time}
                                </span>
                              </div>

                              {m.meeting_type === "online" && m.meeting_link && (
                                <div className="flex items-center gap-1 text-[11px] text-primary-400 truncate">
                                  <LinkIcon size={11} className="shrink-0" />
                                  <span className="truncate">{m.meeting_link}</span>
                                </div>
                              )}

                              {m.meeting_type === "offline" && m.location && (
                                <div className="flex items-center gap-1 text-[11px] text-amber-300/80 truncate">
                                  <MapPin size={11} className="shrink-0" />
                                  <span className="truncate">{m.location}</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1 text-[10px] text-white/40">
                                <span>By {m.organizer_name || "Organizer"}</span>
                                <span>{m.attendees?.length || 0} attendees</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Sub-view Content: Milestones */}
              {meetingSubView === "milestones" && (
                <>
                  {loadingMilestones ? (
                    <div className="glass p-12 text-center rounded-2xl space-y-2">
                      <Loader2 size={24} className="animate-spin mx-auto text-amber-400" />
                      <p className="text-xs text-white/50">Loading milestones...</p>
                    </div>
                  ) : milestones.length === 0 ? (
                    <div className="glass p-10 text-center rounded-2xl border-dashed border-white/15 space-y-3">
                      <Target size={28} className="mx-auto text-white/20" />
                      <h4 className="text-sm font-bold text-white">No Milestones Established</h4>
                      <p className="text-xs text-white/50 max-w-sm mx-auto">
                        Establish milestones with target dates and linked tasks to monitor execution progress.
                      </p>
                      {isLeader && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMilestone(null);
                            setIsCreateMilestoneOpen(true);
                          }}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 transition inline-flex items-center gap-1.5"
                        >
                          <Plus size={13} /> New Milestone
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {milestones.map((ms) => {
                        const statusStyle =
                          MILESTONE_STATUS_BADGE[ms.status] || MILESTONE_STATUS_BADGE.pending;

                        return (
                          <div
                            key={ms.id}
                            onClick={() => setSelectedMilestoneId(ms.id)}
                            className="glass p-5 rounded-2xl hover:border-amber-500/40 transition cursor-pointer group flex flex-col justify-between space-y-3"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`badge text-[10px] font-semibold border ${statusStyle.class}`}
                                >
                                  {statusStyle.label}
                                </span>
                                {ms.is_overdue && ms.status !== "completed" && (
                                  <span className="badge text-[10px] bg-rose-500/10 text-rose-300 border-rose-500/20 font-bold flex items-center gap-1 animate-pulse">
                                    <AlertTriangle size={10} /> Overdue
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition line-clamp-1">
                                {ms.title}
                              </h4>
                              {ms.description && (
                                <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                                  {ms.description}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2 pt-2 border-t border-white/5">
                              <div>
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                  <span className="text-white/40">Progress</span>
                                  <span className="font-mono font-semibold text-white">{ms.progress}%</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      ms.progress === 100
                                        ? "bg-emerald-500"
                                        : ms.is_overdue
                                        ? "bg-rose-500"
                                        : "bg-amber-500"
                                    }`}
                                    style={{ width: `${ms.progress}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 text-[10px] text-white/40">
                                <div className="flex items-center gap-1">
                                  <Calendar size={11} className="text-amber-400" />
                                  <span>
                                    {new Date(ms.due_date).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </div>
                                <span>{ms.linked_task_ids?.length || 0} tasks linked</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Request to Join Modal ────────────────────────────────────── */}
      {isJoinModalOpen && team && (
        <RequestToJoinModal
          isOpen={isJoinModalOpen}
          team={team}
          onClose={() => setIsJoinModalOpen(false)}
          onSuccess={() => {
            void fetchTeam();
          }}
        />
      )}

      {/* ── Edit Team Modal ─────────────────────────────────────────── */}
      {isEditOpen && team && (
        <EditTeamModal
          team={team}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onUpdated={(updated) => setTeam(updated)}
        />
      )}

      {/* ── Phase 4: Invite Member Modal ───────────────────────────── */}
      {isInviteModalOpen && team && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          teamId={team.id}
          teamName={team.name}
          currentMemberCount={team.member_count}
          maxMembers={team.max_members}
          onClose={() => setIsInviteModalOpen(false)}
          onSuccess={() => {
            void fetchTeam();
          }}
        />
      )}

      {/* ── Phase 4: Remove Member Confirmation Modal ────────────────── */}
      {memberToRemove && team && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="glass max-w-md w-full p-6 sm:p-8 bg-dark-800/95 border-red-500/30 shadow-2xl relative animate-slide-up space-y-4 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <UserMinus size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Remove Team Member</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Are you sure you want to remove <strong className="text-white">'{memberToRemove.name || "this member"}'</strong> from {team.name}?
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200/90 leading-relaxed">
              <strong>Notice:</strong> This user will lose team access and their slot will be opened for recruitment.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={() => setMemberToRemove(null)}
                className="btn-ghost text-xs px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemovingMember}
                onClick={handleRemoveMemberConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition"
              >
                {isRemovingMember ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Removing...
                  </>
                ) : (
                  <>
                    <UserMinus size={14} /> Remove Member
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 4: Leave Team Confirmation Modal ───────────────────── */}
      {isLeaveModalOpen && team && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="glass max-w-md w-full p-6 sm:p-8 bg-dark-800/95 border-amber-500/30 shadow-2xl relative animate-slide-up space-y-4 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
              <LogOut size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Leave Team</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Are you sure you want to leave <strong className="text-white">'{team.name}'</strong>?
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
              <strong>Notice:</strong> You will no longer be listed as a team member and will lose collaboration access. You can request to join again later if slots are open.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isLeavingTeam}
                onClick={() => setIsLeaveModalOpen(false)}
                className="btn-ghost text-xs px-4 py-2.5"
              >
                Stay in Team
              </button>
              <button
                type="button"
                disabled={isLeavingTeam}
                onClick={handleLeaveTeamConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition"
              >
                {isLeavingTeam ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Leaving...
                  </>
                ) : (
                  <>
                    <LogOut size={14} /> Confirm & Leave
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 4: Change Role Modal ───────────────────────────────── */}
      {memberToChangeRole && team && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="glass max-w-md w-full p-6 sm:p-8 bg-dark-800/95 border-primary-500/30 shadow-2xl relative animate-slide-up space-y-4 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/20 border border-primary-500/40 flex items-center justify-center text-primary-400 mx-auto">
              <Shield size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Change Member Role</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Select a new functional role for <strong className="text-white">{memberToChangeRole.name || "this member"}</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/80 block">Assign New Role:</label>
              <select
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value)}
                className="input text-xs w-full bg-dark-900 border-white/15"
              >
                {ASSIGNABLE_ROLES.map((roleName) => (
                  <option key={roleName} value={roleName} className="bg-dark-900 text-white">
                    {roleName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={isChangingRole}
                onClick={() => setMemberToChangeRole(null)}
                className="btn-ghost text-xs px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isChangingRole}
                onClick={handleChangeRoleConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs transition"
              >
                {isChangingRole ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Update Role
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────────── */}
      {isDeleteOpen && team && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="glass max-w-md w-full p-6 sm:p-8 bg-dark-800/95 border-red-500/30 shadow-2xl relative animate-slide-up space-y-4 rounded-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-white">Delete Team</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">'{team.name}'</strong>?
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200/90 leading-relaxed">
              <strong>Warning:</strong> Deleting this team permanently removes its team record,
              member roster, and associated challenge linkages. This action cannot be undone.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setIsDeleteOpen(false)}
                className="btn-ghost text-xs px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirm Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 5: Create/Edit Discussion Modal ─────────────────────── */}
      {team && (
        <CreateDiscussionModal
          isOpen={isCreateDiscOpen}
          teamId={team.id}
          teamName={team.name}
          initialDiscussion={editingDiscussion}
          onClose={() => {
            setIsCreateDiscOpen(false);
            setEditingDiscussion(null);
          }}
          onSuccess={() => void fetchDiscussions()}
        />
      )}

      {/* ── Phase 5: Discussion Thread View Modal ─────────────────────── */}
      {activeThreadId && (
        <DiscussionThreadView
          discussionId={activeThreadId}
          onClose={() => setActiveThreadId(null)}
          onDiscussionDeleted={() => {
            setActiveThreadId(null);
            void fetchDiscussions();
          }}
          onDiscussionUpdated={() => void fetchDiscussions()}
          onEditDiscussion={(disc) => {
            setEditingDiscussion(disc);
            setIsCreateDiscOpen(true);
          }}
        />
      )}

      {/* ── Phase 6: Create/Edit Task Modal ──────────────────────────── */}
      {team && (
        <CreateTaskModal
          isOpen={isCreateTaskOpen}
          teamId={team.id}
          teamName={team.name}
          members={teamMemberOptions}
          initialTask={editingTask}
          onClose={() => {
            setIsCreateTaskOpen(false);
            setEditingTask(null);
          }}
          onSuccess={() => void fetchTeamTasks()}
        />
      )}

      {/* ── Phase 6: Task Details View Modal ───────────────────────────── */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          teamMembers={teamMemberOptions}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={() => void fetchTeamTasks()}
          onTaskDeleted={() => void fetchTeamTasks()}
          onEditTask={(t) => {
            setEditingTask(t);
            setIsCreateTaskOpen(true);
          }}
        />
      )}

      {/* ── Phase 7: Schedule/Edit Meeting Modal ──────────────────────── */}
      {team && (
        <ScheduleMeetingModal
          isOpen={isScheduleMeetingOpen}
          teamId={team.id}
          teamName={team.name}
          members={teamMemberOptions}
          initialMeeting={editingMeeting}
          onClose={() => {
            setIsScheduleMeetingOpen(false);
            setEditingMeeting(null);
          }}
          onSuccess={() => void fetchTeamMeetings()}
        />
      )}

      {/* ── Phase 7: Meeting Details Modal ────────────────────────────── */}
      {selectedMeetingId && (
        <MeetingDetailsModal
          meetingId={selectedMeetingId}
          onClose={() => setSelectedMeetingId(null)}
          onMeetingUpdated={() => void fetchTeamMeetings()}
          onMeetingCancelled={() => void fetchTeamMeetings()}
          onMeetingDeleted={() => {
            setSelectedMeetingId(null);
            void fetchTeamMeetings();
          }}
          onEditMeeting={(m) => {
            setSelectedMeetingId(null);
            setEditingMeeting(m);
            setIsScheduleMeetingOpen(true);
          }}
        />
      )}

      {/* ── Phase 7: Create/Edit Milestone Modal ──────────────────────── */}
      {team && (
        <CreateMilestoneModal
          isOpen={isCreateMilestoneOpen}
          teamId={team.id}
          teamName={team.name}
          initialMilestone={editingMilestone}
          onClose={() => {
            setIsCreateMilestoneOpen(false);
            setEditingMilestone(null);
          }}
          onSuccess={() => void fetchTeamMilestones()}
        />
      )}

      {/* ── Phase 7: Milestone Details Modal ─────────────────────────── */}
      {selectedMilestoneId && (
        <MilestoneDetailsModal
          milestoneId={selectedMilestoneId}
          onClose={() => setSelectedMilestoneId(null)}
          onMilestoneUpdated={() => void fetchTeamMilestones()}
          onMilestoneDeleted={() => {
            setSelectedMilestoneId(null);
            void fetchTeamMilestones();
          }}
          onEditMilestone={(ms) => {
            setSelectedMilestoneId(null);
            setEditingMilestone(ms);
            setIsCreateMilestoneOpen(true);
          }}
          onOpenTask={(taskId) => {
            setSelectedTaskId(taskId);
          }}
        />
      )}
    </div>
  );
}
