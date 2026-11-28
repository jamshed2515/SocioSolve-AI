import React, { useState, useEffect } from "react";
import {
  X,
  Search,
  UserPlus,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { UserSearchCandidate } from "../types";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  currentMemberCount: number;
  maxMembers: number;
  onSuccess: () => void;
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  currentMemberCount,
  maxMembers,
  onSuccess,
}: InviteMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<UserSearchCandidate[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchCandidate | null>(null);
  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableSlots = Math.max(0, maxMembers - currentMemberCount);

  // Debounced search for candidate users
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 1) {
      setCandidates([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setErrorMsg(null);
      try {
        const results = await teamApi.searchCandidateUsers(teamId, trimmed);
        setCandidates(results);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to search platform users.";
        setErrorMsg(msg);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, teamId, isOpen]);

  // Reset modal state on close/open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setCandidates([]);
      setSelectedUser(null);
      setMessage("");
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      setErrorMsg("Please select a user to invite.");
      return;
    }
    if (availableSlots <= 0) {
      setErrorMsg("This team has already reached its maximum capacity.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await teamApi.sendInvitation(teamId, {
        invitee_id: selectedUser.id,
        message: message.trim() || undefined,
      });

      toast.success(`Invitation successfully sent to ${selectedUser.name}!`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to send team invitation.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="glass relative w-full max-w-lg rounded-2xl border border-white/10 bg-dark-900/95 p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center border border-primary-500/20">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Invite Team Member</h2>
              <p className="text-xs text-white/50">
                Grow your innovation squad for <span className="text-white font-medium">{teamName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Capacity Indicator Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/70">
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-primary-400" /> Current Capacity:
          </span>
          <span className="font-semibold text-white">
            {currentMemberCount} / {maxMembers} members ({availableSlots} slot{availableSlots === 1 ? "" : "s"} open)
          </span>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-300 text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* User Search Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
              <span>Search Platform Users</span>
              <span className="text-[11px] font-normal text-white/40">By name or email</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a student or researcher's name / email..."
                className="input pl-9 pr-9 text-xs w-full"
                autoFocus
              />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              {isSearching && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Search Results Dropdown List */}
          {searchQuery.trim().length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-dark-800/90 divide-y divide-white/5 space-y-1 p-1">
              {candidates.length === 0 && !isSearching ? (
                <div className="p-4 text-center text-xs text-white/40">
                  No eligible candidates found matching &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                candidates.map((user) => {
                  const isSelected = selectedUser?.id === user.id;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className={`w-full p-2.5 text-left rounded-lg transition-colors flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-primary-500/20 border border-primary-500/40 text-white"
                          : "hover:bg-white/5 text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center font-bold text-xs text-white shrink-0">
                          {user.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                          <p className="text-[11px] text-white/45 truncate">{user.email}</p>
                          {user.skills && user.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {user.skills.slice(0, 3).map((sk) => (
                                <span key={sk} className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                  {sk}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 size={16} className="text-primary-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Selected Candidate Summary Banner */}
          {selectedUser && (
            <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-primary-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {selectedUser.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 text-xs">
                  <span className="font-semibold text-white">Selected: </span>
                  <span className="text-primary-300 font-medium">{selectedUser.name}</span>
                  <span className="text-white/40 block text-[11px] truncate">{selectedUser.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-white/40 hover:text-white text-xs px-2 py-1 rounded bg-white/5"
              >
                Clear
              </button>
            </div>
          )}

          {/* Invitation Message Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
              <span>Invitation Note (Optional)</span>
              <span className="text-[11px] text-white/40">{message.length}/500</span>
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Hi! We love your React skills and would like you to lead our frontend dashboard."
              className="input text-xs w-full resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedUser || availableSlots <= 0}
              className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send size={14} /> Send Invitation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
