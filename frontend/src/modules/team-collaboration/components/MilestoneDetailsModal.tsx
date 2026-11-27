import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Flag,
  Layers,
  Loader2,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { MilestoneStatus, TeamMilestone } from "../types";

interface MilestoneDetailsModalProps {
  milestoneId: string | null;
  onClose: () => void;
  onMilestoneUpdated: (updatedMilestone: TeamMilestone) => void;
  onMilestoneDeleted: (milestoneId: string) => void;
  onEditMilestone?: (milestone: TeamMilestone) => void;
  onOpenTask?: (taskId: string) => void;
}

const STATUS_BADGE: Record<
  MilestoneStatus,
  { label: string; class: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    class: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    icon: <Clock className="w-3.5 h-3.5 mr-1" />,
  },
  in_progress: {
    label: "In Progress",
    class: "bg-primary-500/15 text-primary-300 border-primary-500/30",
    icon: <Sliders className="w-3.5 h-3.5 mr-1" />,
  },
  completed: {
    label: "Completed",
    class: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
  },
  overdue: {
    label: "Overdue",
    class: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    icon: <AlertTriangle className="w-3.5 h-3.5 mr-1" />,
  },
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  in_progress: "text-primary-400 bg-primary-500/10 border-primary-500/20",
  review: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

export default function MilestoneDetailsModal({
  milestoneId,
  onClose,
  onMilestoneUpdated,
  onMilestoneDeleted,
  onEditMilestone,
  onOpenTask,
}: MilestoneDetailsModalProps) {
  const [milestone, setMilestone] = useState<TeamMilestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progress update states
  const [progressVal, setProgressVal] = useState<number>(0);
  const [updatingProgress, setUpdatingProgress] = useState(false);

  // Delete confirm state
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchMilestone = useCallback(async () => {
    if (!milestoneId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teamApi.getMilestoneDetails(milestoneId);
      setMilestone(data);
      setProgressVal(data.progress ?? 0);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load milestone details.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [milestoneId]);

  useEffect(() => {
    void fetchMilestone();
  }, [fetchMilestone]);

  if (!milestoneId) return null;

  const handleSaveProgress = async () => {
    if (!milestone) return;
    setUpdatingProgress(true);
    try {
      const updated = await teamApi.updateMilestoneProgress(milestone.id, progressVal);
      setMilestone(updated);
      onMilestoneUpdated(updated);
      toast.success(`Milestone progress updated to ${progressVal}%!`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update milestone progress.";
      toast.error(msg);
    } finally {
      setUpdatingProgress(false);
    }
  };

  const handleDelete = async () => {
    if (!milestone) return;
    setDeleting(true);
    try {
      await teamApi.deleteMilestone(milestone.id);
      toast.success("Milestone removed. Linked tasks remain preserved.");
      onMilestoneDeleted(milestone.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete milestone.";
      toast.error(msg);
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysRemainingText = (dueDateStr: string, isOverdue: boolean) => {
    try {
      const due = new Date(dueDateStr).getTime();
      const now = Date.now();
      const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

      if (isOverdue) {
        const absDiff = Math.abs(diffDays);
        return `Overdue by ${absDiff} day${absDiff === 1 ? "" : "s"}`;
      }
      if (diffDays === 0) return "Due today";
      if (diffDays === 1) return "Due tomorrow";
      return `Due in ${diffDays} days`;
    } catch {
      return "";
    }
  };

  const canEdit = Boolean(milestone?.permissions?.can_edit);
  const canUpdateProgress = Boolean(milestone?.permissions?.can_update_progress);
  const canDelete = Boolean(milestone?.permissions?.can_delete);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting && !updatingProgress) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            <p className="text-sm text-white/50">Fetching milestone details...</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="p-8 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Error Loading Milestone</h3>
            <p className="text-sm text-white/60">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {/* Loaded Content */}
        {!loading && milestone && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-white/10 bg-slate-900/60">
              <div className="flex items-start gap-3.5 pr-4">
                <div className="p-3 rounded-xl bg-gradient-to-tr from-amber-500/20 to-primary-500/20 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        STATUS_BADGE[milestone.status]?.class ||
                        STATUS_BADGE.pending.class
                      }`}
                    >
                      {STATUS_BADGE[milestone.status]?.icon}
                      {STATUS_BADGE[milestone.status]?.label || milestone.status}
                    </span>

                    {/* Overdue Badge */}
                    {milestone.is_overdue && milestone.status !== "completed" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {getDaysRemainingText(milestone.due_date, true)}
                      </span>
                    )}

                    {milestone.team_name && (
                      <span className="text-xs text-white/40 font-medium">
                        • {milestone.team_name}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white tracking-tight leading-snug">
                    {milestone.title}
                  </h2>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overdue Warning Banner */}
            {milestone.is_overdue && milestone.status !== "completed" && (
              <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20 flex items-center justify-between text-rose-400 text-xs font-medium">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    This milestone has passed its due date ({formatDate(milestone.due_date)}
                    ). Update progress or adjust the timeline.
                  </span>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Description */}
              {milestone.description ? (
                <div>
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                    Description & Objectives
                  </h4>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                    {milestone.description}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/40 italic">
                  No detailed description provided for this milestone.
                </p>
              )}

              {/* Progress Section */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary-400" />
                    Overall Progress
                  </span>
                  <span className="text-sm font-bold text-white font-mono">
                    {canUpdateProgress ? progressVal : milestone.progress}%
                  </span>
                </div>

                {/* Progress bar visual */}
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      (canUpdateProgress ? progressVal : milestone.progress) >= 100
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : milestone.is_overdue
                        ? "bg-gradient-to-r from-rose-500 to-amber-500"
                        : "bg-gradient-to-r from-amber-500 to-primary-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          canUpdateProgress ? progressVal : milestone.progress
                        )
                      )}%`,
                    }}
                  />
                </div>

                {/* Interactive Slider & Quick Jumps (For authorized members/leaders) */}
                {canUpdateProgress && (
                  <div className="pt-2 border-t border-white/5 space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={progressVal}
                        onChange={(e) => setProgressVal(Number(e.target.value))}
                        className="flex-1 accent-amber-500 cursor-pointer h-2 bg-white/10 rounded-lg appearance-none"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {[0, 25, 50, 75, 100].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => setProgressVal(pct)}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                              progressVal === pct
                                ? "bg-amber-500 text-white font-semibold"
                                : "bg-white/5 text-white/60 hover:bg-white/10"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>

                      {progressVal !== milestone.progress && (
                        <button
                          type="button"
                          onClick={handleSaveProgress}
                          disabled={updatingProgress}
                          className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                        >
                          {updatingProgress ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>Save Progress</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Due Date & Meta info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-white/50 font-medium uppercase tracking-wider">
                      Target Due Date
                    </div>
                    <div className="text-xs font-semibold text-white mt-0.5 flex items-center gap-2">
                      <span>{formatDate(milestone.due_date)}</span>
                      {!milestone.is_overdue && milestone.status !== "completed" && (
                        <span className="text-[10px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
                          {getDaysRemainingText(milestone.due_date, false)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-white/50 font-medium uppercase tracking-wider">
                      Created By
                    </div>
                    <div className="text-xs font-semibold text-white mt-0.5">
                      {milestone.creator_name || "Team Member"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked Tasks Section */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary-400" />
                    Linked Tasks ({milestone.linked_tasks?.length || 0})
                  </h4>
                </div>

                {milestone.linked_tasks && milestone.linked_tasks.length > 0 ? (
                  <div className="space-y-2">
                    {milestone.linked_tasks.map((t) => {
                      const statusStyle =
                        TASK_STATUS_COLORS[t.status] || TASK_STATUS_COLORS.todo;

                      return (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-3">
                            <div className="w-2 h-2 rounded-full bg-primary-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">
                                {t.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded border ${statusStyle}`}
                                >
                                  {t.status.replace("_", " ")}
                                </span>
                                {t.priority && (
                                  <span className="text-[10px] text-white/40 uppercase">
                                    {t.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Task progress */}
                            <div className="text-right hidden sm:block">
                              <span className="text-[11px] font-mono text-white/70">
                                {t.progress}%
                              </span>
                              <div className="w-16 bg-white/10 h-1.5 rounded-full overflow-hidden mt-0.5">
                                <div
                                  className="h-full bg-primary-400 rounded-full"
                                  style={{ width: `${t.progress}%` }}
                                />
                              </div>
                            </div>

                            {onOpenTask && (
                              <button
                                type="button"
                                onClick={() => onOpenTask(t.id)}
                                title="Open task details"
                                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-center">
                    <p className="text-xs text-white/40">
                      No tasks are linked to this milestone yet. Edit milestone to link relevant tasks.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="flex items-center justify-between p-6 border-t border-white/10 bg-slate-900/40">
              <div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Milestone</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {canEdit && onEditMilestone && (
                  <button
                    type="button"
                    onClick={() => onEditMilestone(milestone)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 rounded-xl transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Milestone</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        {isDeleteConfirmOpen && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="max-w-md w-full p-6 bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Delete Milestone?</h4>
                <p className="text-xs text-white/60 mt-1.5 leading-relaxed">
                  Are you sure you want to remove{" "}
                  <span className="text-white font-medium">"{milestone?.title}"</span>?
                </p>
                <div className="mt-3 p-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-amber-300/90 text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    <strong>Note:</strong> Deleting this milestone will{" "}
                    <u>NOT</u> delete any of the linked tasks. Your team's tasks remain intact.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/30 disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Yes, Delete</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
