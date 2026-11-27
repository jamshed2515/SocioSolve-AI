import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  CheckSquare,
  Flag,
  Layers,
  Loader2,
  Sparkles,
  Square,
  Target,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type {
  CreateMilestonePayload,
  TeamMilestone,
  UpdateMilestonePayload,
} from "../types";

export interface TaskOption {
  id: string;
  title: string;
  status: string;
  priority?: string;
}

interface CreateMilestoneModalProps {
  isOpen: boolean;
  teamId: string;
  teamName: string;
  availableTasks?: TaskOption[];
  initialMilestone?: TeamMilestone | null; // For editing
  onClose: () => void;
  onSuccess: (milestone: TeamMilestone) => void;
}

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  in_progress: "text-primary-400 bg-primary-500/10 border-primary-500/20",
  review: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
};

export default function CreateMilestoneModal({
  isOpen,
  teamId,
  teamName,
  availableTasks,
  initialMilestone,
  onClose,
  onSuccess,
}: CreateMilestoneModalProps) {
  const isEditing = Boolean(initialMilestone);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskList, setTaskList] = useState<TaskOption[]>(availableTasks || []);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load team tasks if not passed or when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (availableTasks && availableTasks.length > 0) {
      setTaskList(availableTasks);
    } else if (teamId) {
      let isMounted = true;
      setLoadingTasks(true);
      teamApi
        .getTeamTasks(teamId, { limit: 100 })
        .then((res) => {
          if (!isMounted) return;
          const mapped: TaskOption[] = (res.items || []).map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
          }));
          setTaskList(mapped);
        })
        .catch(() => {
          // silently handle or empty list
        })
        .finally(() => {
          if (isMounted) setLoadingTasks(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, teamId, availableTasks]);

  // Populate form fields
  useEffect(() => {
    if (initialMilestone) {
      setTitle(initialMilestone.title || "");
      setDescription(initialMilestone.description || "");
      setDueDate(
        initialMilestone.due_date ? initialMilestone.due_date.substring(0, 10) : ""
      );
      setSelectedTaskIds(initialMilestone.linked_task_ids || []);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setSelectedTaskIds([]);
    }
    setValidationError(null);
  }, [initialMilestone, isOpen]);

  if (!isOpen) return null;

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAllTasks = () => {
    if (selectedTaskIds.length === taskList.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(taskList.map((t) => t.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      setValidationError("Milestone title must be at least 2 characters.");
      return;
    }

    if (!dueDate) {
      setValidationError("Please select a target due date.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && initialMilestone) {
        const payload: UpdateMilestonePayload = {
          title: cleanTitle,
          description: description.trim(),
          due_date: new Date(dueDate).toISOString(),
          linked_task_ids: selectedTaskIds,
        };
        const updated = await teamApi.updateMilestone(initialMilestone.id, payload);
        toast.success("Milestone updated successfully!");
        onSuccess(updated);
        onClose();
      } else {
        const payload: CreateMilestonePayload = {
          title: cleanTitle,
          description: description.trim(),
          due_date: new Date(dueDate).toISOString(),
          linked_task_ids: selectedTaskIds,
        };
        const created = await teamApi.createMilestone(teamId, payload);
        toast.success("Milestone established successfully!");
        onSuccess(created);
        onClose();
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || `Failed to ${isEditing ? "update" : "create"} milestone.`;
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-primary-500/20 border border-amber-500/30 text-amber-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isEditing ? "Edit Milestone" : "Set New Milestone"}
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                Target achievement for team:{" "}
                <span className="text-white/80 font-medium">{teamName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {validationError && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
              Milestone Goal / Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prototype Deployment in Ranchi District"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
              Description & Success Criteria
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline what delivering this milestone entails and any verification criteria..."
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm resize-none"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Target Due Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all text-sm [color-scheme:dark]"
            />
            <p className="text-[11px] text-white/40 mt-1">
              Milestones become marked as Overdue automatically if not completed by this date.
            </p>
          </div>

          {/* Linked Tasks Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary-400" />
                Link Existing Tasks (Optional)
              </label>
              {taskList.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllTasks}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  {selectedTaskIds.length === taskList.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            {loadingTasks ? (
              <div className="flex items-center justify-center p-6 bg-white/[0.02] border border-white/10 rounded-xl">
                <Loader2 className="w-5 h-5 text-primary-400 animate-spin mr-2" />
                <span className="text-xs text-white/50">Loading team tasks...</span>
              </div>
            ) : taskList.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-center">
                <p className="text-xs text-white/40">
                  No existing tasks found for this team. You can still set this milestone and link tasks later.
                </p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-white/[0.02] border border-white/10 rounded-xl divide-y divide-white/5 custom-scrollbar">
                {taskList.map((task) => {
                  const isChecked = selectedTaskIds.includes(task.id);
                  const statusStyle =
                    TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.todo;

                  return (
                    <div
                      key={task.id}
                      onClick={() => toggleTaskSelection(task.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors pt-2.5 ${
                        isChecked
                          ? "bg-primary-500/10 border border-primary-500/20"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-primary-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-white/30 shrink-0" />
                        )}
                        <span className="text-xs text-white font-medium truncate">
                          {task.title}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusStyle}`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-white/40 mt-1.5">
              Linking tasks provides a unified view of what work drives this milestone forward.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-primary-600 hover:from-amber-400 hover:to-primary-500 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEditing ? "Saving Changes..." : "Creating..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{isEditing ? "Save Changes" : "Create Milestone"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
