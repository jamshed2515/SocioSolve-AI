import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Layers,
  PlusCircle,
  FileEdit,
  Trash2,
  Eye,
  Calendar,
  MapPin,
  Clock,
  Inbox,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Send,
  FileText,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import ChallengeStatusBadge from "../../components/challenges/ChallengeStatusBadge";
import challengeService from "../../services/challengeService";
import { useAuth } from "../../context/AuthContext";

const STATUS_TABS = [
  { id: "all", label: "All Challenges" },
  { id: "draft", label: "Drafts" },
  { id: "submitted", label: "Submitted / Review" },
  { id: "published", label: "Published" },
  { id: "closed", label: "Closed / Resolved" },
];

export default function MyChallengesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get("status") || "all");
  const [challenges, setChallenges] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);

  const limit = 10;

  const fetchMyChallenges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit,
      };

      if (activeTab !== "all") {
        params.status = activeTab;
      }

      const res = await challengeService.getMyChallenges(params);
      setChallenges(res.challenges || []);
      setTotal(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err) {
      console.error("Failed to load user challenges:", err);
      const msg = err.response?.data?.detail || "Failed to load your submitted challenges.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, limit]);

  useEffect(() => {
    fetchMyChallenges();
  }, [fetchMyChallenges]);

  // Sync tab and page with URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("status", activeTab);
    if (page > 1) params.set("page", String(page));
    setSearchParams(params, { replace: true });
  }, [activeTab, page, setSearchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
  };

  const handleDelete = async (challenge) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${challenge.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setActionInProgress(challenge.id);
      await challengeService.deleteChallenge(challenge.id);
      toast.success("Challenge deleted successfully");
      fetchMyChallenges();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete challenge";
      toast.error(msg);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleQuickSubmitDraft = async (challenge) => {
    try {
      setActionInProgress(challenge.id);
      await challengeService.updateChallengeStatus(challenge.id, {
        status: "submitted",
        reason: "Author submitted draft for review",
      });
      toast.success("Draft submitted for review!");
      fetchMyChallenges();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to submit draft";
      toast.error(msg);
    } finally {
      setActionInProgress(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-300 border border-primary-500/20 mb-2">
              <Layers size={14} />
              <span>Challenge Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              My Submitted Challenges
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Track the approval lifecycle, review progress, and community engagement for your
              problems.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchMyChallenges}
              disabled={loading}
              className="btn-ghost inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <Link
              to="/challenges/new"
              className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/20"
            >
              <PlusCircle size={16} />
              <span>Submit New Challenge</span>
            </Link>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-white/10">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                activeTab === tab.id
                  ? "bg-primary-500 text-white shadow-md shadow-primary-500/20"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="glass rounded-2xl border border-white/10 p-6 space-y-4 animate-pulse"
              >
                <div className="flex justify-between items-center">
                  <div className="h-6 w-1/3 bg-white/10 rounded" />
                  <div className="h-6 w-24 bg-white/5 rounded-full" />
                </div>
                <div className="h-4 w-2/3 bg-white/5 rounded" />
                <div className="h-8 w-full bg-white/5 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="glass rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-4 max-w-lg mx-auto">
            <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-semibold text-white">Could not load challenges</h3>
            <p className="text-sm text-slate-300">{error}</p>
            <button
              onClick={fetchMyChallenges}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
            >
              <RotateCcw size={15} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && challenges.length === 0 && (
          <div className="glass rounded-2xl border border-white/10 p-12 text-center space-y-4 max-w-lg mx-auto">
            <div className="inline-flex p-4 rounded-2xl bg-white/5 text-slate-400">
              <Inbox size={36} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">No challenges here yet</h3>
              <p className="text-sm text-slate-400 mt-1">
                {activeTab !== "all"
                  ? `You do not have any challenges with status "${activeTab}".`
                  : "You haven't submitted any societal challenges yet."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/challenges/new"
                className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold"
              >
                <PlusCircle size={15} />
                <span>Submit Your First Challenge</span>
              </Link>
            </div>
          </div>
        )}

        {/* Challenges List View */}
        {!loading && !error && challenges.length > 0 && (
          <div className="space-y-4">
            {challenges.map((c) => (
              <div
                key={c.id}
                className="glass rounded-2xl border border-white/10 p-5 md:p-6 transition-all hover:border-white/20 bg-surface-card space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-primary-300 bg-primary-500/10 border border-primary-500/20 px-2.5 py-0.5 rounded-full">
                        {c.category}
                      </span>
                      <ChallengeStatusBadge status={c.status} size="sm" />
                      {c.challengeCode && (
                        <span className="font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded text-[11px]">
                          {c.challengeCode}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/challenges/${c.id}`}
                      className="block text-base md:text-lg font-bold text-white hover:text-primary-300 transition-colors"
                    >
                      {c.title}
                    </Link>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                    {c.status === "draft" && (
                      <button
                        onClick={() => handleQuickSubmitDraft(c)}
                        disabled={actionInProgress === c.id}
                        className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                        title="Submit draft for review"
                      >
                        <Send size={13} />
                        <span>Submit</span>
                      </button>
                    )}

                    <Link
                      to={`/challenges/${c.id}`}
                      className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 hover:bg-white/5 text-slate-300"
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </Link>

                    <Link
                      to={`/challenges/${c.id}/edit`}
                      className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 hover:bg-white/5 text-slate-300"
                    >
                      <FileEdit size={13} />
                      <span>Edit</span>
                    </Link>

                    <button
                      onClick={() => handleDelete(c)}
                      disabled={actionInProgress === c.id}
                      className="btn-ghost inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium border border-rose-500/20 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Excerpt */}
                <p className="text-xs md:text-sm text-slate-300 line-clamp-2 leading-relaxed">
                  {c.description}
                </p>

                {/* Metadata Footer */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary-400" />
                      <span>{c.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      <span>Created {formatDate(c.createdAt)}</span>
                    </div>
                    {c.deadline && (
                      <div className="flex items-center gap-1.5 text-amber-300">
                        <Clock size={14} />
                        <span>Deadline: {formatDate(c.deadline)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Eye size={13} />
                      <span>{c.viewsCount || 0} views</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText size={13} />
                      <span>{c.proposalsCount || 0} proposals</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
                <span className="text-slate-400">
                  Page {page} of {totalPages} ({total} challenges)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2 rounded-xl border border-white/10 bg-surface-card hover:bg-white/5 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-2 rounded-xl border border-white/10 bg-surface-card hover:bg-white/5 text-slate-300 disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
