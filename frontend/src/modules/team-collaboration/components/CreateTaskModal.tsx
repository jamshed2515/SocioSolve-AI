import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Flag,
  Loader2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type {
  CreateTaskPayload,
  TaskPriority,
  TeamTask,
  UpdateTaskPayload,
} from "../types";

interface MemberOption {
  user_id: string;
  name: string;
  role?: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  teamId: string;
  teamName: string;
  members: MemberOption[];
  initialTask?: TeamTask | null; // For editing
  onClose: () => void;
  onSuccess: (task: TeamTask) => void;
}

const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "text-slate-300 border-slate-500/30 bg-slate-500/10" },
  { value: "medium", label: "Medium", color: "text-primary-300 border-primary-500/30 bg-primary-500/10" },
  { value: "high", label: "High", color: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  { value: "urgent", label: "Urgent", color: "text-rose-300 border-rose-500/30 bg-rose-500/10" },
];

export default function CreateTaskModal({
  isOpen,
  teamId,
  teamName,
  members,
  initialTask,
  onClose,
  onSuccess,
}: CreateTaskModalProps) {
  const isEditing = Boolean(initialTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Pre-fill when editing or reset on open
  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title || "");
      setDescription(initialTask.description || "");
      setPriority(initialTask.priority || "medium");
      setAssignedTo(initialTask.assigned_to || []);
      setStartDate(initialTask.start_date ? initialTask.start_date.substring(0, 10) : "");
      setDueDate(initialTask.due_date ? initialTask.due_date.substring(0, 10) : "");
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssignedTo([]);
      setStartDate("");
      setDueDate("");
    }
    setValidationError(null);
  }, [initialTask, isOpen]);

  if (!isOpen) return null;

  const toggleAssignee = (userId: string) => {
    setAssignedTo((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle.length < 2) {
      setValidationError("Task title must be at least 2 characters.");
      return;
    }
    if (cleanTitle.length > 150) {
      setValidationError("Task title cannot exceed 150 characters.");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      setValidationError("Due date cannot be earlier than start date.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && initialTask) {
        const payload: UpdateTaskPayload = {
          title: cleanTitle,
          description: description.trim(),
          priority,
          assigned_to: assignedTo,
          start_date: startDate ? new Date(startDate).toISOString() : null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        };
        const updated = await teamApi.updateTask(initialTask.id, payload);
        toast.success("Task updated successfully!");
        onSuccess(updated);
      } else {
        const payload: CreateTaskPayload = {
          title: cleanTitle,
          description: description.trim(),
          priority,
          assigned_to: assignedTo,
          start_date: startDate ? new Date(startDate).toISOString() : null,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
        };
        const created = await teamApi.createTask(teamId, payload);
        toast.success("Task created successfully!");
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      const errObj = err as {
        response?: { data?: { detail?: string | Array<{ msg?: string }>; message?: string } | string };
        message?: string;
      };
      let msg = "Failed to save task.";
      const data = errObj?.response?.data;
      if (typeof data === "string" && data.trim()) {
        msg = data;
      } else if (typeof data?.detail === "string") {
        msg = data.detail;
      } else if (Array.isArray(data?.detail)) {
        msg = data.detail.map((d) => d.msg || JSON.stringify(d)).join(", ");
      } else if (typeof data?.message === "string") {
        msg = data.message;
      } else if (errObj?.message) {
        msg = errObj.message;
      }
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
              <Flag size={18} className="text-primary-400" />
              {isEditing ? "Edit Task" : "Create New Task"}
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

        {/* Validation Error Alert */}
        {validationError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Task Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={150}
              placeholder="e.g., Deploy IoT sensor prototype in Bokaro panchayat"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input w-full text-xs py-2.5"
            />
            <span className="text-[10px] text-white/40 float-right mt-1">
              {title.length}/150
            </span>
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITIES.map((p) => {
                const isSelected = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition text-center ${
                      isSelected
                        ? `${p.color} border-current ring-1 ring-current font-bold`
                        : "bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.06]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              Description / Sprint Deliverables
            </label>
            <textarea
              rows={3}
              maxLength={3000}
              placeholder="Detail technical requirements, expected outputs, or testing protocols..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full text-xs py-2 resize-none"
            />
          </div>

          {/* Date Range: Start & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5 flex items-center gap-1">
                <Calendar size={12} className="text-primary-400" /> Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-full text-xs py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5 flex items-center gap-1">
                <Clock size={12} className="text-amber-400" /> Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input w-full text-xs py-2"
              />
            </div>
          </div>

          {/* Assign Members Multi-select */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Users size={12} className="text-primary-400" /> Assign Team Members ({assignedTo.length})
              </span>
              <span className="text-[10px] text-white/40">Select one or more assignees</span>
            </label>

            {members.length === 0 ? (
              <p className="text-xs text-white/40 italic p-3 bg-white/[0.02] rounded-xl border border-white/5">
                No squad members available to assign.
              </p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-white/[0.02] rounded-xl border border-white/10">
                {members.map((m) => {
                  const isAssigned = assignedTo.includes(m.user_id);
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
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                          {m.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="truncate">
                          <span className="font-medium text-white">{m.name}</span>
                          {m.role && (
                            <span className="text-[10px] text-white/40 ml-1.5 font-normal">
                              ({m.role})
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
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
            )}
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
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? "Update Task" : "Create Task"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
