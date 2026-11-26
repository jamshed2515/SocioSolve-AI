import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { JoinRequest, JoinRequestStatus } from "../types";

const STATUS_CONFIG: Record<
  JoinRequestStatus,
  { label: string; badgeClass: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending Review",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    icon: Clock,
  },
  accepted: {
    label: "Accepted",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "bg-white/10 text-white/50 border-white/15",
    icon: X,
  },
};

export default function MyJoinRequests() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await teamApi.getMyJoinRequests(selectedStatus);
      setRequests(res.requests || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load your join requests.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleCancelRequest = async (requestId: string, teamName?: string) => {
    setCancellingId(requestId);
    try {
      await teamApi.cancelJoinRequest(requestId);
      toast.success(
        teamName
          ? `Join request for '${teamName}' was cancelled.`
          : "Join request cancelled."
      );
      // Update status immediately in state without full page reload
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status: "cancelled", updated_at: new Date().toISOString() }
            : r
        )
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to cancel request.";
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* ── Header Banner ─────────────────────────────────────────── */}
      <div className="glass p-6 sm:p-7 bg-gradient-to-r from-primary-500/15 via-dark-700/60 to-accent-400/10 border-primary-500/25 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-primary-300 font-medium">
              <Clock size={12} />
              <span>Module 3 – Applications</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              My Team Applications
            </h1>
            <p className="text-xs sm:text-sm text-white/55 max-w-2xl">
              Track your pending, approved, and past requests to join societal innovation teams in Jharkhand.
            </p>
          </div>

          <Link
            to="/teams/explore"
            className="btn-primary text-xs px-4 py-2.5 shadow-md shadow-primary-500/25 shrink-0 flex items-center gap-1.5"
          >
            <Compass size={15} /> Explore More Teams
          </Link>
        </div>
      </div>

      {/* ── Status Filters ─────────────────────────────────────────── */}
      <div className="glass p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "pending", "accepted", "rejected", "cancelled"] as const).map(
            (statusKey) => {
              const isActive = selectedStatus === statusKey;
              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() => setSelectedStatus(statusKey)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize flex items-center gap-1.5 ${
                    isActive
                      ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
                      : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5"
                  }`}
                >
                  <span>{statusKey}</span>
                  {statusKey === "pending" && pendingCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>

        <button
          type="button"
          onClick={fetchRequests}
          disabled={loading}
          className="text-xs text-white/50 hover:text-white transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Loading Skeleton ───────────────────────────────────────── */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass p-6 rounded-2xl space-y-3 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-5 w-40 bg-white/10 rounded" />
                <div className="h-5 w-24 bg-white/10 rounded-full" />
              </div>
              <div className="h-4 w-3/4 bg-white/5 rounded" />
              <div className="h-10 w-full bg-white/5 rounded-xl" />
              <div className="pt-3 border-t border-white/5 flex justify-between">
                <div className="h-4 w-32 bg-white/5 rounded" />
                <div className="h-4 w-20 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error State ────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="glass p-8 text-center space-y-3 border-red-500/30 rounded-2xl">
          <AlertCircle size={24} className="mx-auto text-red-400" />
          <h3 className="text-base font-semibold text-red-200">{error}</h3>
          <button
            type="button"
            onClick={fetchRequests}
            className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-2"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* ── Empty State ────────────────────────────────────────────── */}
      {!loading && !error && requests.length === 0 && (
        <div className="glass p-12 text-center border-dashed border-white/15 space-y-4 rounded-2xl">
          <FileText size={32} className="mx-auto text-white/30" />
          <h3 className="text-base font-semibold text-white">No Join Requests Found</h3>
          <p className="text-xs text-white/50 max-w-sm mx-auto">
            {selectedStatus === "all"
              ? "You haven't submitted any team join requests yet. Browse active teams and send an application to get started!"
              : `You don't have any requests with status '${selectedStatus}'.`}
          </p>
          <Link
            to="/teams/explore"
            className="btn-primary text-xs px-5 py-2.5 inline-flex items-center gap-2"
          >
            <Compass size={15} /> Explore Teams
          </Link>
        </div>
      )}

      {/* ── Requests List ──────────────────────────────────────────── */}
      {!loading && !error && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((req) => {
            const config =
              STATUS_CONFIG[req.status as JoinRequestStatus] ||
              STATUS_CONFIG.pending;
            const StatusIcon = config.icon;

            const submittedDate = new Date(req.created_at).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric", year: "numeric" }
            );

            const isPending = req.status === "pending";
            const isCancelling = cancellingId === req.id;

            return (
              <div
                key={req.id}
                className="glass p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className={`badge text-[11px] font-semibold border ${config.badgeClass} flex items-center gap-1 capitalize`}
                      >
                        <StatusIcon size={12} /> {config.label}
                      </span>
                      {req.team_status && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/50 border border-white/10 uppercase tracking-wider font-semibold">
                          Team: {req.team_status}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white hover:text-primary-300 transition">
                      <Link to={`/teams/${req.team_id}`}>
                        {req.team_name || "Innovation Team"}
                      </Link>
                    </h3>

                    {req.challenge_title && (
                      <p className="text-xs text-accent-300 font-medium flex items-center gap-1.5 mt-0.5">
                        <Compass size={13} className="shrink-0" />
                        <span>{req.challenge_title}</span>
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <Link
                      to={`/teams/${req.team_id}`}
                      className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition flex items-center gap-1.5"
                    >
                      <Eye size={13} />
                      <span>View Team</span>
                    </Link>

                    {isPending && (
                      <button
                        type="button"
                        disabled={isCancelling}
                        onClick={() => handleCancelRequest(req.id, req.team_name)}
                        className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isCancelling ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            <span>Cancelling...</span>
                          </>
                        ) : (
                          <>
                            <X size={13} />
                            <span>Cancel Request</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Application Message */}
                {req.message && (
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/75 leading-relaxed italic">
                    <span className="font-semibold not-italic text-white/40 block mb-1">
                      Your note to the leader:
                    </span>
                    &ldquo;{req.message}&rdquo;
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/45">
                  <div className="flex items-center gap-4">
                    <span>
                      Team Leader: <strong className="text-white/70">{req.leader_name}</strong>
                    </span>
                    {req.member_count !== undefined && req.max_members !== undefined && (
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-primary-400" />
                        {req.member_count} / {req.max_members} members
                      </span>
                    )}
                  </div>

                  <span className="flex items-center gap-1">
                    <Calendar size={11} /> Submitted {submittedDate}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
