import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Filter,
  Flag,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import CreateTaskModal from "../components/CreateTaskModal";
import TaskDetailsModal from "../components/TaskDetailsModal";
import type { TaskPriority, TaskStatus, Team, TeamTask } from "../types";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All Tasks" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "completed", label: "Completed" },
];

const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  medium: "bg-primary-500/15 text-primary-300 border-primary-500/30",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  urgent: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  todo: "bg-white/10 text-white/70 border-white/20",
  in_progress: "bg-primary-500/20 text-primary-300 border-primary-500/30",
  review: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export default function TeamTasks() {
  const [viewMode, setViewMode] = useState<"my_tasks" | "team_board">("my_tasks");

  // Teams state
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Tasks state
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("due_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

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
            ?.detail || "Failed to load your teams.";
        setError(msg);
      } finally {
        setLoadingTeams(false);
      }
    }
    void loadTeams();
  }, []);

  // 2. Fetch tasks based on active view mode
  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    setError(null);
    try {
      if (viewMode === "my_tasks") {
        const res = await teamApi.getMyTasks({
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          priority: selectedPriority !== "all" ? selectedPriority : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: 100,
        });
        setTasks(res.items || []);
      } else {
        if (!selectedTeamId) {
          setTasks([]);
          setLoadingTasks(false);
          return;
        }
        const res = await teamApi.getTeamTasks(selectedTeamId, {
          search: searchQuery.trim() || undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          priority: selectedPriority !== "all" ? selectedPriority : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: 100,
        });
        setTasks(res.items || []);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load tasks.";
      setError(msg);
    } finally {
      setLoadingTasks(false);
    }
  }, [viewMode, selectedTeamId, selectedStatus, selectedPriority, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const selectedTeam = myTeams.find((t) => t.id === selectedTeamId);

  // Candidate team members for assignment in Create/Edit task modal
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
    for (const m of selectedTeam.members || []) {
      if (m.user_id !== selectedTeam.leader_id) {
        list.push({
          user_id: m.user_id,
          name: m.name || "Member",
          role: m.role || "Member",
        });
      }
    }
    return list;
  }, [selectedTeam]);

  // Client-side search for My Tasks (or server query for team board)
  const filteredTasks = tasks.filter((t) => {
    if (viewMode === "my_tasks" && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || "").toLowerCase().includes(q);
      const matchTeam = (t.team_name || "").toLowerCase().includes(q);
      return matchTitle || matchDesc || matchTeam;
    }
    return true;
  });

  // KPI Statistics
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const reviewCount = tasks.filter((t) => t.status === "review").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const overdueCount = tasks.filter((t) => t.is_overdue).length;

  const isUpcoming = (dueDateStr?: string | null, status?: string) => {
    if (!dueDateStr || status === "completed") return false;
    const now = new Date().getTime();
    const due = new Date(dueDateStr).getTime();
    const diffDays = (due - now) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 3;
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <ListTodo size={24} className="text-primary-400" />
            {viewMode === "my_tasks" ? "My Tasks Dashboard" : "Team Task Board"}
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Track deliverables, update sprint progress, and coordinate milestones across Jharkhand challenges.
          </p>
        </div>

        {/* View Mode Toggle & Create Task Trigger */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="glass p-1 rounded-xl border border-white/10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("my_tasks")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === "my_tasks"
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setViewMode("team_board")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                viewMode === "team_board"
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Team Board
            </button>
          </div>

          {viewMode === "team_board" && selectedTeam?.is_leader && (
            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setIsCreateModalOpen(true);
              }}
              className="btn btn-primary text-xs flex items-center gap-1.5"
            >
              <Plus size={14} /> Create Task
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="glass p-3.5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] text-white/40 uppercase font-semibold">Total</span>
          <p className="text-lg font-bold text-white font-mono">{totalTasks}</p>
        </div>
        <div className="glass p-3.5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] text-primary-400 uppercase font-semibold">In Progress</span>
          <p className="text-lg font-bold text-primary-300 font-mono">{inProgressCount}</p>
        </div>
        <div className="glass p-3.5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] text-purple-400 uppercase font-semibold">In Review</span>
          <p className="text-lg font-bold text-purple-300 font-mono">{reviewCount}</p>
        </div>
        <div className="glass p-3.5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] text-emerald-400 uppercase font-semibold">Completed</span>
          <p className="text-lg font-bold text-emerald-300 font-mono">{completedCount}</p>
        </div>
        <div className="glass p-3.5 rounded-2xl border border-white/10 space-y-1">
          <span className="text-[10px] text-rose-400 uppercase font-semibold">Overdue</span>
          <p className="text-lg font-bold text-rose-300 font-mono">{overdueCount}</p>
        </div>
      </div>

      {/* ── Filters & Search Control Bar ─────────────────────────────── */}
      <div className="glass p-4 rounded-2xl border border-white/10 space-y-3">
        {/* Team Selector when in Team Board view */}
        {viewMode === "team_board" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary-400 shrink-0" />
              <span className="text-xs text-white/60">Active Team:</span>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="input py-1 px-2.5 text-xs font-semibold bg-dark-800 text-white border-white/15 rounded-lg max-w-xs"
              >
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_leader ? "(Leader)" : "(Member)"}
                  </option>
                ))}
              </select>
            </div>
            {selectedTeam && (
              <span className="text-[11px] text-white/40">
                {selectedTeam.member_count || 1} squad members enrolled
              </span>
            )}
          </div>
        )}

        {/* Search, Status, Priority & Sorting */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder={
                viewMode === "my_tasks"
                  ? "Search assigned tasks by title, team, or description..."
                  : "Search team tasks by title..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 text-xs py-2 w-full"
            />
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-white/50 flex items-center gap-1">
              <Flag size={12} /> Priority:
            </span>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="input py-1 px-2.5 text-xs bg-dark-800 text-white border-white/15 rounded-lg"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {/* Sort By Due Date / Created Date */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-white/50 flex items-center gap-1">
              <Clock size={12} /> Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input py-1 px-2.5 text-xs bg-dark-800 text-white border-white/15 rounded-lg"
            >
              <option value="due_date">Due Date</option>
              <option value="created_at">Created Date</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="btn btn-secondary text-xs px-2 py-1.5"
              title="Toggle sort direction"
            >
              {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
            </button>
            <button
              type="button"
              onClick={() => void fetchTasks()}
              className="btn btn-secondary text-xs p-2"
              title="Refresh tasks"
            >
              <RefreshCw size={13} className={loadingTasks ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSelectedStatus(tab.value)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition whitespace-nowrap ${
                selectedStatus === tab.value
                  ? "bg-primary-500 text-white shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading Skeleton ──────────────────────────────────────────── */}
      {loadingTasks && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
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

      {/* ── Empty State ──────────────────────────────────────────────── */}
      {!loadingTasks && filteredTasks.length === 0 && (
        <div className="glass p-12 text-center rounded-2xl border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 text-white/40 flex items-center justify-center mx-auto">
            <ListTodo size={24} />
          </div>
          <h3 className="text-base font-semibold text-white">No tasks found</h3>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            {searchQuery || selectedStatus !== "all" || selectedPriority !== "all"
              ? "No tasks match your selected filter criteria. Try resetting filters."
              : viewMode === "my_tasks"
              ? "You currently have no tasks assigned to you. Once team leaders assign deliverables, they will appear here."
              : `No tasks have been created in ${selectedTeam?.name || "this team"} yet.`}
          </p>

          {viewMode === "team_board" && selectedTeam?.is_leader && (
            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setIsCreateModalOpen(true);
              }}
              className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2"
            >
              <Plus size={14} /> Create First Task
            </button>
          )}
        </div>
      )}

      {/* ── Tasks Grid List ───────────────────────────────────────────── */}
      {!loadingTasks && filteredTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTasks.map((task) => {
            const hasOverdue = task.is_overdue;
            const hasUpcoming = isUpcoming(task.due_date, task.status);

            const dueDateFormatted = task.due_date
              ? new Date(task.due_date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "No deadline";

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`glass p-5 rounded-2xl border transition-all cursor-pointer hover:border-primary-500/40 hover:bg-white/[0.04] space-y-3.5 relative overflow-hidden group ${
                  task.status === "completed"
                    ? "border-emerald-500/20 bg-emerald-500/[0.01]"
                    : hasOverdue
                    ? "border-rose-500/30 bg-rose-500/[0.02]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {/* Priority & Status Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`badge text-[10px] uppercase font-bold border px-2 py-0.5 ${
                        PRIORITY_BADGE[task.priority] || "bg-white/10 text-white"
                      }`}
                    >
                      <Flag size={9} className="mr-1 inline" /> {task.priority}
                    </span>

                    <span
                      className={`badge text-[10px] capitalize font-semibold border px-2 py-0.5 ${
                        STATUS_BADGE[task.status] || "bg-white/10 text-white"
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>

                    {hasOverdue && (
                      <span className="badge text-[10px] bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold flex items-center gap-1">
                        <AlertCircle size={10} /> Overdue
                      </span>
                    )}

                    {hasUpcoming && !hasOverdue && (
                      <span className="badge text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold flex items-center gap-1">
                        <Clock size={10} /> Due soon
                      </span>
                    )}
                  </div>

                  {task.team_name && (
                    <span className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 max-w-[140px] truncate">
                      {task.team_name}
                    </span>
                  )}
                </div>

                {/* Title & Description Preview */}
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-primary-300 transition">
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-xs text-white/60 line-clamp-2 mt-1 leading-relaxed">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Progress Bar & Percentage */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-white/40">Progress</span>
                    <span className="font-mono font-semibold text-white/80">{task.progress}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.progress === 100
                          ? "bg-emerald-500"
                          : task.progress > 50
                          ? "bg-primary-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer: Due Date & Assigned Avatars */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                  <span
                    className={`text-[11px] flex items-center gap-1 ${
                      hasOverdue ? "text-rose-400 font-bold" : "text-white/40"
                    }`}
                  >
                    <Clock size={11} className={hasOverdue ? "text-rose-400" : "text-amber-400"} />
                    {dueDateFormatted}
                  </span>

                  {/* Assignee Avatar Stack */}
                  <div className="flex items-center -space-x-1.5">
                    {task.assigned_members.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        title={m.name}
                        className="w-5 h-5 rounded-full bg-primary-500/40 border border-dark-900 text-primary-200 font-bold flex items-center justify-center text-[9px]"
                      >
                        {m.name?.[0]?.toUpperCase() || "U"}
                      </div>
                    ))}
                    {task.assigned_members.length > 3 && (
                      <div className="w-5 h-5 rounded-full bg-white/10 border border-dark-900 text-white/60 font-semibold flex items-center justify-center text-[9px]">
                        +{task.assigned_members.length - 3}
                      </div>
                    )}
                    {task.assigned_members.length === 0 && (
                      <span className="text-[10px] text-white/30 italic">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals: Create / Edit Task Modal ──────────────────────────── */}
      {selectedTeam && (
        <CreateTaskModal
          isOpen={isCreateModalOpen}
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          members={teamMemberOptions}
          initialTask={editingTask}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingTask(null);
          }}
          onSuccess={() => void fetchTasks()}
        />
      )}

      {/* ── Modals: Task Details View Modal ───────────────────────────── */}
      {selectedTaskId && (
        <TaskDetailsModal
          taskId={selectedTaskId}
          teamMembers={teamMemberOptions}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={() => void fetchTasks()}
          onTaskDeleted={() => void fetchTasks()}
          onEditTask={(t) => {
            setEditingTask(t);
            setIsCreateModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
