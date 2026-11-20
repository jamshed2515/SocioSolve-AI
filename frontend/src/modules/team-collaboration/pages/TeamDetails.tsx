import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Crown,
  Edit3,
  Layers,
  Loader2,
  MessageSquare,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../../context/AuthContext";
import EditTeamModal from "../components/EditTeamModal";
import teamApi from "../services/teamApi";
import type { AuthUser, Team } from "../types";

type DetailTab = "overview" | "members" | "discussions" | "tasks" | "meetings";

const STATUS_BADGE: Record<string, string> = {
  recruiting: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  full: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  active: "bg-primary-500/20 text-primary-300 border-primary-500/30",
  completed: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
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
        <Link to="/teams/my-teams" className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-2">
          <ArrowLeft size={14} /> Back to My Teams
        </Link>
      </div>
    );
  }

  const isLeader =
    team.is_leader ||
    (user?.id && String(user.id) === String(team.leader_id));

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

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ── Breadcrumb & Top Bar ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to="/teams/my-teams"
          className="inline-flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white transition"
        >
          <ArrowLeft size={15} /> Back to My Teams
        </Link>

        {isLeader && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* ── Team Header Card ────────────────────────────────────────── */}
      <div className="glass p-6 sm:p-8 bg-gradient-to-r from-primary-500/15 via-dark-700/60 to-accent-400/10 border-primary-500/25">
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
          <div className="glass p-5 bg-dark-800/80 border-white/10 shrink-0 w-full lg:w-72 space-y-3">
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
          <Calendar size={15} /> Meetings{" "}
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/5 text-white/40">Phase 6</span>
        </button>
      </div>

      {/* ── TAB 1: OVERVIEW ─────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Mission Card */}
            <div className="glass p-6 md:col-span-2 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-accent-400" />
                Team Scope & Mission
              </h3>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed whitespace-pre-line">
                {team.description}
              </p>
            </div>

            {/* Meta Attributes */}
            <div className="glass p-6 space-y-4">
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
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users size={18} className="text-primary-400" /> Team Roster ({team.members.length})
            </h3>
            <span className="text-xs text-white/45">
              Max capacity: {team.max_members} members
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.members.map((member) => {
              const isLeaderRole = member.role === "Team Leader";
              const joinedDate = new Date(member.joined_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <div
                  key={member.user_id}
                  className={`glass p-5 rounded-2xl border transition-all ${
                    isLeaderRole
                      ? "border-amber-500/30 bg-amber-500/[0.04]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
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
                          : "bg-white/5 text-white/60"
                      }`}
                    >
                      {isLeaderRole && <Crown size={10} className="mr-1 inline text-amber-400" />}
                      {member.role}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
                    <span>Joined: {joinedDate}</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <UserCheck size={11} /> Active
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: DISCUSSIONS (PLACEHOLDER FOR PHASE 4) ─────────────── */}
      {activeTab === "discussions" && (
        <div className="glass p-10 text-center space-y-3 border-dashed border-white/15">
          <MessageSquare size={32} className="mx-auto text-primary-400" />
          <h3 className="text-base font-bold text-white">Real-Time Team Discussions</h3>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            Team messaging and WebSocket / Socket.IO live threads will be implemented in Phase 4.
          </p>
        </div>
      )}

      {/* ── TAB 4: TASKS (PLACEHOLDER FOR PHASE 5) ──────────────────── */}
      {activeTab === "tasks" && (
        <div className="glass p-10 text-center space-y-3 border-dashed border-white/15">
          <CheckCircle2 size={32} className="mx-auto text-accent-400" />
          <h3 className="text-base font-bold text-white">Collaborative Task Tracking</h3>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            Task creation, assignment, and sprint deliverables will be implemented in Phase 5.
          </p>
        </div>
      )}

      {/* ── TAB 5: MEETINGS (PLACEHOLDER FOR PHASE 6) ────────────────── */}
      {activeTab === "meetings" && (
        <div className="glass p-10 text-center space-y-3 border-dashed border-white/15">
          <Calendar size={32} className="mx-auto text-amber-400" />
          <h3 className="text-base font-bold text-white">Team Meetings & Milestones</h3>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            Meeting scheduling, agendas, and SIH milestone sign-offs will be implemented in Phase 6.
          </p>
        </div>
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

      {/* ── Delete Confirmation Modal ───────────────────────────────── */}
      {isDeleteOpen && team && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
        >
          <div className="glass max-w-md w-full p-6 sm:p-8 bg-dark-800/95 border-red-500/30 shadow-2xl relative animate-slide-up space-y-4">
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
    </div>
  );
}
