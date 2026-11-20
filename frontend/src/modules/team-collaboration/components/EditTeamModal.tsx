import React, { useState } from "react";
import { AlertCircle, Loader2, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { Team, UpdateTeamPayload } from "../types";

interface EditTeamModalProps {
  team: Team;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedTeam: Team) => void;
}

export default function EditTeamModal({
  team,
  isOpen,
  onClose,
  onUpdated,
}: EditTeamModalProps) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [maxMembers, setMaxMembers] = useState(team.max_members);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const currentMembersCount = team.member_count || team.members?.length || 1;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Team name is required.";
    } else if (name.trim().length < 2) {
      newErrors.name = "Team name must be at least 2 characters.";
    }

    if (!description.trim()) {
      newErrors.description = "Team description is required.";
    } else if (description.trim().length < 5) {
      newErrors.description = "Team description must be at least 5 characters.";
    }

    if (maxMembers < 2 || maxMembers > 20) {
      newErrors.maxMembers = "Maximum team members must be between 2 and 20.";
    } else if (maxMembers < currentMembersCount) {
      newErrors.maxMembers = `Cannot reduce capacity below current team size (${currentMembersCount} members).`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload: UpdateTeamPayload = {
        name: name.trim(),
        description: description.trim(),
        max_members: Number(maxMembers),
      };

      const updated = await teamApi.updateTeam(team.id, payload);
      toast.success("Team settings updated successfully!");
      onUpdated(updated);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update team settings.";
      toast.error(msg);
      setErrors({ form: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div className="glass max-w-lg w-full p-6 sm:p-8 bg-dark-800/95 border-white/15 shadow-2xl relative animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">Edit Team Settings</h3>
            <p className="text-xs text-white/50 mt-0.5">
              Modify team profile and member capacity
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Error Notice */}
        {errors.form && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-200">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Team Name */}
          <div>
            <label className="label">
              Team Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input text-sm"
              placeholder="e.g. JalRakshak Squad"
              maxLength={100}
            />
            {errors.name && <p className="error-text">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="label">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input text-sm resize-none"
              placeholder="Outline your team's mission, solution approach, and target outcomes..."
              maxLength={1000}
            />
            {errors.description && (
              <p className="error-text">{errors.description}</p>
            )}
          </div>

          {/* Maximum Team Capacity */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">
                Maximum Members <span className="text-red-400">*</span>
              </label>
              <span className="text-xs font-semibold text-primary-300">
                {maxMembers} Members
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={Math.max(2, currentMembersCount)}
                max={20}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full accent-primary-500 cursor-pointer"
              />
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 shrink-0">
                Min: {Math.max(2, currentMembersCount)}
              </span>
            </div>
            <p className="text-[11px] text-white/40 mt-1 flex items-center gap-1.5">
              <Users size={12} className="text-accent-400" />
              Current team size: {currentMembersCount} member(s). Cannot reduce below current membership.
            </p>
            {errors.maxMembers && (
              <p className="error-text">{errors.maxMembers}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-ghost text-xs px-4 py-2.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-5 py-2.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

