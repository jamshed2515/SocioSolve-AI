import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { Team } from "../types";

interface RequestToJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
  onSuccess: (teamId: string) => void;
}

export default function RequestToJoinModal({
  isOpen,
  onClose,
  team,
  onSuccess,
}: RequestToJoinModalProps) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !team) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await teamApi.submitJoinRequest({
        team_id: team.id,
        message: message.trim() || undefined,
      });

      toast.success(`Join request sent to ${team.name}! 🎉`);
      setMessage("");
      onSuccess(team.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to submit join request. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg glass border border-white/15 p-6 sm:p-7 rounded-2xl shadow-2xl bg-dark-800/90 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-400">
              Module 3 – Collaboration
            </span>
            <h3 className="text-xl font-bold text-white mt-0.5">Request to Join Team</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Team Preview Card */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white text-base">{team.name}</h4>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
              Recruiting
            </span>
          </div>
          <p className="text-xs text-white/60 line-clamp-2">{team.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/50 pt-1">
            <span>
              Leader: <strong className="text-white/80">{team.leader_name || "Team Leader"}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} className="text-primary-400" />
              {team.member_count} / {team.max_members} members
            </span>
            {team.challenge_title && (
              <span className="text-accent-300 truncate max-w-xs">
                {team.challenge_title}
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="join-message" className="label text-xs">
                Note to Team Leader <span className="text-white/40">(Optional)</span>
              </label>
              <span className="text-[11px] text-white/40">
                {message.length} / 500
              </span>
            </div>
            <textarea
              id="join-message"
              rows={4}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Introduce yourself! Mention your skills (e.g. React, IoT, Python), why you want to solve this challenge, or what role you would like to play in the team..."
              className="input text-sm resize-none"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-xs px-5 py-2.5 shadow-lg shadow-primary-500/25 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
