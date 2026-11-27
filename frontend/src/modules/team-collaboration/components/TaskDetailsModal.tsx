import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Flag,
  Loader2,
  Sliders,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { TaskPriority, TaskStatus, TeamTask } from "../types";

interface MemberOption {
  user_id: string;
  name: string;
  role?: string;
}

interface TaskDetailsModalProps {
  taskId: string | null;
  teamMembers?: MemberOption[];
  onClose: () => void;
  onTaskUpdated: (updatedTask: TeamTask) => void;
  onTaskDeleted: (taskId: string) => void;
  onEditTask?: (task: TeamTask) => void;
}

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

export default function TaskDetailsModal({
  taskId,
  teamMembers = [],
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  onEditTask,
}: TaskDetailsModalProps) {
  const [task, setTask] = useState<TeamTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status & Progress update states
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [progressVal, setProgressVal] = useState<number>(0);
  const [updatingProgress, setUpdatingProgress] = useState(false);

  // Reassignment state (Leader only)
  const [isReassigning, setIsReassigning] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [savingAssignees, setSavingAssignees] = useState(false);

  // Delete state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teamApi.getTaskDetails(taskId);
      setTask(data);
      setProgressVal(data.progress || 0);
      setSelectedAssignees(data.assigned_to || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load task details.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void fetchTask();
  }, [fetchTask]);

  if (!taskId) return null;

  // Status transition handler
  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task || updatingStatus || task.status === newStatus) return;
    setUpdatingStatus(true);
    try {
      const updated = await teamApi.updateTaskStatus(task.id, newStatus);
      setTask(updated);
      setProgressVal(updated.progress);
      toast.success(`Task status changed to '${newStatus.replace("_", " ")}'.`);
      onTaskUpdated(updated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update status.";
      toast.error(msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Progress update handler
  const handleProgressSave = async () => {
    if (!task || updatingProgress || progressVal === task.progress) return;
    setUpdatingProgress(true);
    try {
      const updated = await teamApi.updateTaskProgress(task.id, progressVal);
      setTask(updated);
      toast.success(`Task progress updated to ${updated.progress}%.`);
      onTaskUpdated(updated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update progress.";
      toast.error(msg);
    } finally {
      setUpdatingProgress(false);
    }
  };

  // Reassignment handler
  const handleSaveReassignment = async () => {
    if (!task || savingAssignees) return;
    setSavingAssignees(true);
    try {
      const updated = await teamApi.reassignTask(task.id, selectedAssignees);
      setTask(updated);
      setIsReassigning(false);
      toast.success("Task assignees updated successfully!");
      onTaskUpdated(updated);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to reassign task.";
      toast.error(msg);
    } finally {
      setSavingAssignees(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!task || deleting) return;
    setDeleting(true);
    try {
      await teamApi.deleteTask(task.id);
      toast.success(`Task '${task.title}' deleted.`);
      onTaskDeleted(task.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete task.";
      toast.error(msg);
    } finally {
      setDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  const perms = task?.permissions;
  const canUpdateStatus = perms?.can_update_status;
  const canUpdateProgress = perms?.can_update_progress;
  const canEdit = perms?.can_edit;
  const canDelete = perms?.can_delete;
  const canReassign = perms?.can_reassign;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto"
    >
      <div className="glass max-w-xl w-full p-6 sm:p-7 bg-dark-800/95 border-white/10 shadow-2xl relative animate-slide-up rounded-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4 gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {task?.priority && (
                <span
                  className={`badge text-[10px] uppercase font-bold border px-2 py-0.5 ${
                    PRIORITY_BADGE[task.priority] || "bg-white/10 text-white"
                  }`}
                >
                  <Flag size={9} className="mr-1 inline" /> {task.priority}
                </span>
              )}
              {task?.status && (
                <span
                  className={`badge text-[10px] capitalize font-semibold border px-2 py-0.5 ${
                    STATUS_BADGE[task.status] || "bg-white/10 text-white"
                  }`}
                >
                  {task.status.replace("_", " ")}
                </span>
              )}
              {task?.is_overdue && (
                <span className="badge text-[10px] bg-rose-500/20 text-rose-300 border-rose-500/30 flex items-center gap-1 font-semibold animate-pulse">
                  <AlertCircle size={10} /> Overdue
                </span>
              )}
              {task?.team_name && (
                <span className="text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                  {task.team_name}
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white break-words">
              {task?.title || "Loading Task..."}
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
            <span>Loading task specifications...</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && task && (
          <div className="space-y-5 text-xs">
            {/* Description */}
            <div className="space-y-1.5">
              <span className="text-white/40 font-semibold uppercase tracking-wider text-[10px]">
                Description & Deliverables
              </span>
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-white/80 leading-relaxed whitespace-pre-wrap">
                {task.description || "No detailed description provided for this task."}
              </div>
            </div>

            {/* Dates & Creator Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-white/60">
              <div>
                <span className="text-[10px] text-white/40 block mb-0.5">Created By</span>
                <span className="text-white font-medium truncate block">
                  {task.creator_name || "Team Leader"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block mb-0.5">Start Date</span>
                <span className="text-white font-medium flex items-center gap-1">
                  <Calendar size={11} className="text-primary-400" />
                  {task.start_date
                    ? new Date(task.start_date).toLocaleDateString()
                    : "Not set"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-white/40 block mb-0.5">Due Date</span>
                <span
                  className={`font-medium flex items-center gap-1 ${
                    task.is_overdue ? "text-rose-400 font-bold" : "text-white"
                  }`}
                >
                  <Clock size={11} className={task.is_overdue ? "text-rose-400" : "text-amber-400"} />
                  {task.due_date
                    ? new Date(task.due_date).toLocaleDateString()
                    : "No deadline"}
                </span>
              </div>
            </div>

            {/* Progress Section */}
            <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-white flex items-center gap-1.5">
                  <Sliders size={13} className="text-primary-400" /> Completion Progress
                </span>
                <span className="text-primary-300 font-mono text-sm">{progressVal}%</span>
              </div>

              {/* Progress Bar Display */}
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    progressVal === 100
                      ? "bg-emerald-500"
                      : progressVal > 50
                      ? "bg-primary-500"
                      : "bg-amber-500"
                  }`}
                  style={{ width: `${progressVal}%` }}
                />
              </div>

              {/* Interactive Progress Slider for assigned / leader */}
              {canUpdateProgress ? (
                <div className="pt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progressVal}
                    disabled={updatingProgress}
                    onChange={(e) => setProgressVal(Number(e.target.value))}
                    className="w-full accent-primary-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    disabled={updatingProgress || progressVal === task.progress}
                    onClick={handleProgressSave}
                    className="btn btn-primary text-[11px] py-1 px-3 shrink-0 inline-flex items-center gap-1"
                  >
                    {updatingProgress ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>Save</span>
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-white/40 italic pt-1">
                  Only assigned squad members or the team leader can update task progress.
                </p>
              )}
            </div>

            {/* Status Update Quick Buttons */}
            {canUpdateStatus && (
              <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-white font-semibold text-xs flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" /> Update Task Status
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {(["todo", "in_progress", "review", "completed"] as TaskStatus[]).map((st) => {
                    const isCurrent = task.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={updatingStatus || isCurrent}
                        onClick={() => handleStatusChange(st)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition capitalize text-center ${
                          isCurrent
                            ? `${STATUS_BADGE[st]} ring-1 ring-current cursor-default`
                            : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]"
                        }`}
                      >
                        {st.replace("_", " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Assigned Members Section */}
            <div className="space-y-2 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold text-xs flex items-center gap-1.5">
                  <Users size={13} className="text-primary-400" /> Assigned Squad Members (
                  {task.assigned_members.length})
                </span>

                {canReassign && (
                  <button
                    type="button"
                    onClick={() => setIsReassigning(!isReassigning)}
                    className="text-[11px] text-primary-400 hover:text-primary-300 font-medium"
                  >
                    {isReassigning ? "Cancel" : "Reassign Members"}
                  </button>
                )}
              </div>

              {!isReassigning ? (
                <div className="space-y-1.5 pt-1">
                  {task.assigned_members.length === 0 ? (
                    <p className="text-white/40 italic text-xs">No members currently assigned.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {task.assigned_members.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs"
                        >
                          <div className="w-5 h-5 rounded-full bg-primary-500/30 text-primary-300 font-bold flex items-center justify-center text-[10px]">
                            {m.name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <span className="font-medium text-white">{m.name}</span>
                          {m.role && <span className="text-[10px] text-white/40">({m.role})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Reassignment Form for Leader */
                <div className="space-y-2.5 pt-2">
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-white/[0.02] rounded-xl border border-white/10">
                    {teamMembers.map((m) => {
                      const isAssigned = selectedAssignees.includes(m.user_id);
                      return (
                        <div
                          key={m.user_id}
                          onClick={() => toggleAssignee(m.user_id)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                            isAssigned
                              ? "bg-primary-500/20 border border-primary-500/40 text-white"
                              : "hover:bg-white/5 text-white/70"
                          }`}
                        >
                          <span className="font-medium">{m.name}</span>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isAssigned
                                ? "bg-primary-500 border-primary-400 text-white"
                                : "border-white/20"
                            }`}
                          >
                            {isAssigned && <Check size={10} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={savingAssignees}
                      onClick={() => setIsReassigning(false)}
                      className="btn btn-secondary text-[11px] py-1 px-3"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingAssignees}
                      onClick={handleSaveReassignment}
                      className="btn btn-primary text-[11px] py-1 px-3 inline-flex items-center gap-1"
                    >
                      {savingAssignees ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <UserCheck size={12} />
                      )}
                      <span>Save Assignees</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions: Edit & Delete */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-[10px] text-white/40">
                Last updated: {new Date(task.updated_at).toLocaleDateString()}
              </span>

              <div className="flex items-center gap-2">
                {canEdit && onEditTask && (
                  <button
                    type="button"
                    onClick={() => {
                      onEditTask(task);
                      onClose();
                    }}
                    className="btn btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <Edit3 size={13} />
                    <span>Edit Task</span>
                  </button>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmOpen && task && (
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
                <h4 className="text-sm font-bold text-white">Delete Task?</h4>
                <p className="text-xs text-white/60">
                  Are you sure you want to delete <strong className="text-white">'{task.title}'</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteConfirm}
                  className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 inline-flex items-center gap-1"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
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
