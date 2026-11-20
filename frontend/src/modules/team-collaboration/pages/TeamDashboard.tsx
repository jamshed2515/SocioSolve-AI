import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Clock,
  Database,
  FolderKanban,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import StatCard from "../components/StatCard";
import { EmptyState, ErrorState, LoadingState } from "../components/StateBanner";
import type { TeamOutletContext } from "../components/TeamCollaborationLayout";
import {
  MOCK_DASHBOARD_STATS,
  MOCK_PENDING_TASKS,
  MOCK_RECENT_ACTIVITIES,
  MOCK_RECENT_TEAMS,
  MOCK_UPCOMING_MEETINGS,
} from "../data/mockDashboardData";
import teamApi from "../services/teamApi";
import type { AuthUser, PreviewViewState, Team } from "../types";

const TEAM_STATUS_BADGE = {
  Active: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  Recruiting: "bg-primary-500/20 text-primary-300 border border-primary-500/30",
  Review: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
} as const;

const PRIORITY_BADGE = {
  High: "bg-rose-500/20 text-rose-300",
  Medium: "bg-amber-500/20 text-amber-300",
  Low: "bg-cyan-500/20 text-cyan-300",
} as const;

const TASK_STATUS_BADGE = {
  "In Progress": "bg-primary-500/20 text-primary-300",
  "To Do": "bg-white/10 text-white/70",
  Blocked: "bg-red-500/20 text-red-300",
} as const;

const ACTIVITY_ICON = {
  task: CheckCircle2,
  discussion: MessageSquare,
  member: UserPlus,
  milestone: Sparkles,
} as const;

export default function TeamDashboard() {
  const { user } = useAuth() as { user: AuthUser | null };
  const { backendHealth } = useOutletContext<TeamOutletContext>();
  const [viewState, setViewState] = useState<PreviewViewState>("ready");
  const [liveTeams, setLiveTeams] = useState<Team[]>([]);

  useEffect(() => {
    let active = true;
    teamApi
      .getMyTeams(1, 5)
      .then((res) => {
        if (active && res.teams) {
          setLiveTeams(res.teams);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const firstName = user?.name ? user.name.split(" ")[0] : "Innovator";

  // Compute dynamic stats based on live data if available
  const statsToRender = MOCK_DASHBOARD_STATS.map((stat) => {
    if (stat.id === "joined-teams" && liveTeams.length > 0) {
      return {
        ...stat,
        value: liveTeams.length,
        changeText: `${liveTeams.filter((t) => t.is_leader).length} as Lead · ${liveTeams.filter((t) => !t.is_leader).length} as Member`,
      };
    }
    return stat;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Welcome & Module Status Hero ───────────────────────────────── */}
      <section className="glass p-6 bg-gradient-to-r from-primary-500/15 via-dark-700/60 to-accent-400/10 border-primary-500/25">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-accent-400">
              <Sparkles size={13} />
              <span>Phase 2 Operational · Live Team Management Active</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Welcome back, {firstName}
            </h2>
            <p className="text-sm text-white/60 max-w-2xl">
              Coordinate multidisciplinary teams tackling civic, environmental,
              and rural innovation challenges across Jharkhand.
            </p>
            <div className="pt-2">
              <Link
                to="/teams/create"
                className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5 shadow-md shadow-primary-500/25"
              >
                <Plus size={15} /> Form a New Team
              </Link>
            </div>
          </div>

          {/* Quick UI State Inspector (for verifying loading, empty & error states) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/40 mr-1">View state:</span>
            {(["ready", "loading", "empty", "error"] as PreviewViewState[]).map(
              (mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewState(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                    viewState === mode
                      ? "bg-primary-500 text-white shadow-sm shadow-primary-500/30"
                      : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {mode}
                </button>
              )
            )}
          </div>
        </div>

        {/* Live FastAPI & MongoDB Connection Readout */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-white/70">
              <Server size={14} className="text-primary-400" />
              <span>FastAPI:</span>
              <strong
                className={
                  backendHealth.loading
                    ? "text-white/60"
                    : backendHealth.apiReachable
                      ? "text-emerald-300"
                      : "text-red-300"
                }
              >
                {backendHealth.loading
                  ? "Checking..."
                  : backendHealth.apiReachable
                    ? `Healthy (${backendHealth.healthStatus})`
                    : "Unreachable"}
              </strong>
            </span>

            <span className="inline-flex items-center gap-1.5 text-white/70">
              <Database size={14} className="text-accent-400" />
              <span>MongoDB:</span>
              <strong
                className={
                  backendHealth.loading
                    ? "text-white/60"
                    : backendHealth.moduleStatus?.database.connected
                      ? "text-emerald-300"
                      : "text-amber-300"
                }
              >
                {backendHealth.loading
                  ? "Checking..."
                  : backendHealth.moduleStatus?.database.connected
                    ? `Connected (${backendHealth.moduleStatus.database.database_name})`
                    : backendHealth.apiReachable
                      ? "Not initialized"
                      : "Unavailable"}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => void backendHealth.refresh()}
            className="inline-flex items-center gap-1.5 text-primary-300 hover:text-primary-200 font-medium transition"
          >
            <RefreshCw
              size={13}
              className={backendHealth.loading ? "animate-spin" : ""}
            />
            <span>Recheck Backend</span>
          </button>
        </div>
      </section>

      {/* Live API Error Banner when FastAPI backend is down */}
      {!backendHealth.loading && !backendHealth.apiReachable && (
        <ErrorState
          title="FastAPI Backend Connection Warning"
          message={`Could not reach the backend API (${backendHealth.error || "Network error"}). Start FastAPI on port 8000 or verify VITE_API_URL in frontend/.env. Mock dashboard widgets remain visible below.`}
          onRetry={() => void backendHealth.refresh()}
        />
      )}

      {/* ── Conditional View States ────────────────────────────────────── */}
      {viewState === "loading" && (
        <LoadingState
          title="Loading Team Collaboration Dashboard..."
          description="Synchronizing team statistics, upcoming meetings, and pending tasks."
        />
      )}

      {viewState === "empty" && (
        <EmptyState
          icon={<Users className="w-6 h-6 text-primary-400" />}
          title="No Teams or Activities Yet"
          description="You haven't joined or created any collaboration teams yet. Explore open Jharkhand societal challenges to form or join a team."
          action={
            <Link to="/teams/explore" className="btn-primary text-xs px-5 py-2.5">
              Explore Teams <ArrowRight size={14} />
            </Link>
          }
        />
      )}

      {viewState === "error" && (
        <ErrorState
          title="Unable to Load Dashboard Widgets"
          message="A simulated error state is active to verify error recovery UI. Click Retry to restore the dashboard view."
          onRetry={() => setViewState("ready")}
        />
      )}

      {viewState === "ready" && (
        <>
          {/* ── 5 Required Statistics Cards ────────────────────────────── */}
          <section aria-label="Team Collaboration Statistics">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {statsToRender.map((stat) => (
                <StatCard key={stat.id} stat={stat} />
              ))}
            </div>
          </section>

          {/* ── Primary 2-Column Workspace Grid ────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* My Recent Teams (2 cols on xl) */}
            <section className="glass p-6 xl:col-span-2 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-500/15 flex items-center justify-center">
                    <FolderKanban size={18} className="text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      My Recent Teams
                    </h3>
                    <p className="text-xs text-white/45">
                      Active societal innovation teams you collaborate with
                    </p>
                  </div>
                </div>
                <Link
                  to="/teams/my-teams"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-300 hover:text-primary-200 transition"
                >
                  View all <ArrowRight size={14} />
                </Link>
              </div>

              <div className="space-y-3.5">
                {MOCK_RECENT_TEAMS.map((team) => (
                  <div
                    key={team.id}
                    className="p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-primary-500/35 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-white">
                            {team.name}
                          </h4>
                          <span
                            className={`badge text-[11px] ${TEAM_STATUS_BADGE[team.status]}`}
                          >
                            {team.status}
                          </span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/5 text-white/60">
                            {team.role}
                          </span>
                        </div>
                        <p className="text-xs text-white/55 mt-1">
                          {team.challengeTitle}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-white/45 shrink-0">
                        <MapPin size={13} className="text-accent-400" />
                        {team.district}, JH
                      </span>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[11px] text-white/50 mb-1.5">
                          <span>Milestone progress</span>
                          <span className="font-semibold text-white/80">
                            {team.progressPercent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-accent-400"
                            style={{ width: `${team.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-white/50 shrink-0">
                        <span className="inline-flex items-center gap-1">
                          <Users size={13} />
                          {team.memberCount}/{team.maxMembers} members
                        </span>
                        <span className="text-white/35">{team.lastUpdated}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent Team Activities (1 col on xl) */}
            <section className="glass p-6 flex flex-col">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent-400/15 flex items-center justify-center">
                    <Activity size={18} className="text-accent-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Recent Team Activities
                    </h3>
                    <p className="text-xs text-white/45">Latest team updates</p>
                  </div>
                </div>
                <Link
                  to="/teams/discussions"
                  className="text-xs font-semibold text-primary-300 hover:text-primary-200 transition"
                >
                  Feed
                </Link>
              </div>

              <div className="space-y-4">
                {MOCK_RECENT_ACTIVITIES.map((item) => {
                  const CategoryIcon = ACTIVITY_ICON[item.category];
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 pb-3.5 border-b border-white/5 last:border-b-0 last:pb-0"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-[11px] font-bold text-primary-200 shrink-0">
                        {item.actorInitials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/85 leading-relaxed">
                          <span className="font-semibold text-white">
                            {item.actorName}
                          </span>{" "}
                          <span className="text-white/55">{item.action}</span>{" "}
                          <span className="text-white/90 font-medium">
                            {item.target}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-white/40">
                          <CategoryIcon size={12} className="text-accent-400" />
                          <span className="truncate">{item.teamName}</span>
                          <span>·</span>
                          <span className="shrink-0">{item.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ── Secondary 2-Column Grid: Upcoming Meetings & Pending Tasks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Meetings */}
            <section className="glass p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                    <CalendarClock size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Upcoming Meetings
                    </h3>
                    <p className="text-xs text-white/45">
                      Scheduled syncs & milestone reviews
                    </p>
                  </div>
                </div>
                <Link
                  to="/teams/meetings"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-300 hover:text-primary-200 transition"
                >
                  Schedule <ArrowRight size={14} />
                </Link>
              </div>

              <div className="space-y-3">
                {MOCK_UPCOMING_MEETINGS.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-amber-500/30 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {meeting.title}
                        </h4>
                        <p className="text-xs text-primary-300 mt-0.5">
                          {meeting.teamName}
                        </p>
                      </div>
                      <span className="badge bg-white/5 text-white/70 text-[11px] shrink-0">
                        <Video size={11} className="mr-1 text-accent-400" />
                        {meeting.mode}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={13} className="text-amber-400" />
                        {meeting.dateLabel} · {meeting.timeLabel}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={13} />
                        {meeting.participantsCount} attendees
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Pending Tasks */}
            <section className="glass p-6">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                    <CheckSquare size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Pending Tasks
                    </h3>
                    <p className="text-xs text-white/45">
                      Deliverables assigned across your teams
                    </p>
                  </div>
                </div>
                <Link
                  to="/teams/tasks"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-300 hover:text-primary-200 transition"
                >
                  All tasks <ArrowRight size={14} />
                </Link>
              </div>

              <div className="space-y-3">
                {MOCK_PENDING_TASKS.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-white leading-snug">
                          {task.title}
                        </h4>
                        <p className="text-xs text-white/45 mt-1">
                          {task.teamName}
                        </p>
                      </div>
                      <span
                        className={`badge text-[11px] shrink-0 ${PRIORITY_BADGE[task.priority]}`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${TASK_STATUS_BADGE[task.status]}`}
                      >
                        {task.status}
                      </span>
                      <span className="inline-flex items-center gap-1 text-white/50">
                        <Clock size={12} />
                        {task.dueLabel}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

