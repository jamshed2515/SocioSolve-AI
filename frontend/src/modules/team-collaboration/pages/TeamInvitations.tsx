import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Send,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  ArrowRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Users,
  Compass,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { TeamInvitation, InvitationStatus } from "../types";

export default function TeamInvitations() {
  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [receivedList, setReceivedList] = useState<TeamInvitation[]>([]);
  const [sentList, setSentList] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Action states for specific item IDs
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchReceived = useCallback(async () => {
    try {
      const res = await teamApi.getReceivedInvitations(statusFilter);
      setReceivedList(res.items || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load received invitations.";
      setError(msg);
    }
  }, [statusFilter]);

  const fetchSent = useCallback(async () => {
    try {
      const res = await teamApi.getSentInvitations({ status: statusFilter });
      setSentList(res.items || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load sent invitations.";
      setError(msg);
    }
  }, [statusFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "received") {
        await fetchReceived();
      } else {
        await fetchSent();
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchReceived, fetchSent]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Accept/Reject (for received invitations)
  const handleDecision = async (invitationId: string, decision: "accepted" | "rejected") => {
    if (processingId) return;
    setProcessingId(invitationId);
    try {
      const updated = await teamApi.respondToInvitation(invitationId, decision);
      toast.success(
        decision === "accepted"
          ? `Accepted! You have joined ${updated.team_name}.`
          : `Invitation declined.`
      );
      setReceivedList((prev) =>
        prev.map((item) => (item.id === invitationId ? { ...item, status: decision } : item))
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || `Failed to ${decision} invitation.`;
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Cancel (for leader sent invitations)
  const handleCancel = async (invitationId: string) => {
    if (processingId) return;
    setProcessingId(invitationId);
    try {
      await teamApi.cancelInvitation(invitationId);
      toast.success("Invitation cancelled.");
      setSentList((prev) =>
        prev.map((item) => (item.id === invitationId ? { ...item, status: "cancelled" } : item))
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to cancel invitation.";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: InvitationStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="badge text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <Clock size={11} /> Pending
          </span>
        );
      case "accepted":
        return (
          <span className="badge text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
            <CheckCircle2 size={11} /> Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="badge text-[11px] bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <XCircle size={11} /> Rejected
          </span>
        );
      case "cancelled":
        return (
          <span className="badge text-[11px] bg-white/10 text-white/50 border border-white/15 flex items-center gap-1">
            <Ban size={11} /> Cancelled
          </span>
        );
    }
  };

  const currentList = activeTab === "received" ? receivedList : sentList;
  const pendingCount = receivedList.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <Mail size={24} className="text-primary-400" /> Team Invitations
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Manage collaboration invites sent by leaders or addressed to you across Jharkhand.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="btn btn-secondary text-xs self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* ── Tabs & Status Filters Bar ───────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-3">
        {/* Main View Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("received");
              setStatusFilter("all");
            }}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2 ${
              activeTab === "received"
                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Inbox size={15} /> Received ({receivedList.length})
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-400 text-dark-900 font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("sent");
              setStatusFilter("all");
            }}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2 ${
              activeTab === "sent"
                ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <Send size={15} /> Sent by Me ({sentList.length})
          </button>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/10 overflow-x-auto">
          {["all", "pending", "accepted", "rejected", "cancelled"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition capitalize whitespace-nowrap ${
                statusFilter === st
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading Skeleton ────────────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass p-5 rounded-2xl border border-white/10 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="h-4 bg-white/10 rounded w-20" />
              </div>
              <div className="h-3 bg-white/10 rounded w-1/2" />
              <div className="h-10 bg-white/5 rounded-xl w-full" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      {!loading && currentList.length === 0 && (
        <div className="glass p-12 text-center rounded-2xl border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 text-white/40 flex items-center justify-center mx-auto">
            {activeTab === "received" ? <Inbox size={24} /> : <Send size={24} />}
          </div>
          <h3 className="text-base font-semibold text-white">
            {activeTab === "received" ? "No invitations received" : "No invitations sent yet"}
          </h3>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            {activeTab === "received"
              ? "When innovation team leaders invite you to join their squads, their invitations will appear here."
              : "As a team leader, you can invite peers and researchers from your team's details page."}
          </p>
          {activeTab === "received" && (
            <Link to="/teams/explore" className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2">
              <Compass size={14} /> Explore Active Teams
            </Link>
          )}
        </div>
      )}

      {/* ── Invitations List ─────────────────────────────────────────────── */}
      {!loading && currentList.length > 0 && (
        <div className="space-y-4">
          {currentList.map((item) => {
            const isProcessing = processingId === item.id;
            const isPending = item.status === "pending";
            const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={item.id}
                className="glass p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-all space-y-4"
              >
                {/* Top Row: Team Name, Challenge & Status Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/teams/${item.team_id}`}
                        className="text-base font-bold text-white hover:text-primary-300 transition-colors"
                      >
                        {item.team_name}
                      </Link>
                      {getStatusBadge(item.status)}
                    </div>
                    {item.challenge_title && (
                      <p className="text-xs text-accent-300 font-medium flex items-center gap-1">
                        <Compass size={13} /> {item.challenge_title}
                      </p>
                    )}
                  </div>

                  <span className="text-[11px] text-white/40 flex items-center gap-1 shrink-0">
                    <Clock size={12} /> Sent {dateStr}
                  </span>
                </div>

                {/* Second Row: Person Details */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  {activeTab === "received" ? (
                    <div className="flex items-center gap-2.5 text-white/70">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {item.inviter_name?.[0]?.toUpperCase() || "L"}
                      </div>
                      <div>
                        <span className="text-white/40 block text-[10px]">INVITED BY TEAM LEADER</span>
                        <strong className="text-white font-semibold">{item.inviter_name}</strong>
                        {item.inviter_email && (
                          <span className="text-white/40 ml-1.5">({item.inviter_email})</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 text-white/70">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-400 to-primary-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {item.invitee_name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <span className="text-white/40 block text-[10px]">INVITATION SENT TO</span>
                        <strong className="text-white font-semibold">{item.invitee_name}</strong>
                        {item.invitee_email && (
                          <span className="text-white/40 ml-1.5">({item.invitee_email})</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-white/50 text-[11px]">
                    <Users size={13} className="text-primary-400" />
                    <span>Capacity: {item.member_count} / {item.max_members}</span>
                  </div>
                </div>

                {/* Optional Message */}
                {item.message && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/70 italic">
                    &ldquo;{item.message}&rdquo;
                  </div>
                )}

                {/* Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                  <Link
                    to={`/teams/${item.team_id}`}
                    className="text-xs text-primary-300 hover:text-primary-200 font-medium inline-flex items-center gap-1"
                  >
                    View Team Details <ArrowRight size={13} />
                  </Link>

                  {/* Actions for Received Tab */}
                  {activeTab === "received" && isPending && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDecision(item.id, "rejected")}
                        disabled={isProcessing}
                        className="btn btn-secondary text-xs px-3 py-1.5 text-rose-300 hover:text-rose-200 flex items-center gap-1.5"
                      >
                        {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Decline
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecision(item.id, "accepted")}
                        disabled={isProcessing}
                        className="btn btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                      >
                        {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Accept Invitation
                      </button>
                    </div>
                  )}

                  {/* Actions for Sent Tab (Leader Cancel) */}
                  {activeTab === "sent" && isPending && (
                    <button
                      type="button"
                      onClick={() => void handleCancel(item.id)}
                      disabled={isProcessing}
                      className="btn btn-secondary text-xs px-3 py-1.5 text-white/60 hover:text-rose-300 flex items-center gap-1.5"
                    >
                      {isProcessing ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                      Cancel Invitation
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
