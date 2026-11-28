import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  FileEdit,
  Trash2,
  Send,
  Eye,
  RotateCcw,
  Star,
  MessageSquare,
  AlertTriangle,
  FolderKanban,
  ArrowLeft,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import ProposalStatusBadge, { ProposalWorkflowStepper } from "../../components/proposals/ProposalStatusBadge";
import proposalService from "../../services/proposalService";

export default function MyProposals() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Confirmation modal state
  const [confirmAction, setConfirmAction] = useState(null); // { type: 'delete' | 'submit' | 'withdraw', proposal }
  const [withdrawReason, setWithdrawReason] = useState("Withdrawn by team to revise technical architecture.");
  const [processing, setProcessing] = useState(false);

  const fetchMyProposals = useCallback(async () => {
    try {
      setLoading(true);
      const params = { sortBy, limit: 30 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;

      const data = await proposalService.listMyProposals(params);
      setProposals(data.items || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load your proposals.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy]);

  useEffect(() => {
    fetchMyProposals();
  }, [fetchMyProposals]);

  const handleConfirmExecute = async () => {
    if (!confirmAction) return;
    const { type, proposal } = confirmAction;
    try {
      setProcessing(true);
      if (type === "delete") {
        await proposalService.deleteDraftProposal(proposal.id);
        toast.success("Draft proposal deleted.");
      } else if (type === "submit") {
        await proposalService.submitProposal(proposal.id);
        toast.success("Proposal officially submitted for evaluation!");
      } else if (type === "withdraw") {
        await proposalService.withdrawProposal(proposal.id, withdrawReason);
        toast.success("Proposal withdrawn.");
      } else if (type === "reopen") {
        await proposalService.reopenProposal(proposal.id, "Reopened withdrawn proposal as draft for revision.");
        toast.success("Proposal reopened as draft! You can now edit and resubmit.");
      }
      setConfirmAction(null);
      fetchMyProposals();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${type} proposal.`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout title="My Proposals & Drafts">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link
            to="/proposals"
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-2"
          >
            <ArrowLeft size={14} /> Back to Proposal Dashboard
          </Link>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderKanban size={22} className="text-primary-400" />
            Manage My Solution Proposals
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Edit drafts, submit completed proposals, track evaluation progress, and view reviewer feedback.
          </p>
        </div>

        <Link to="/proposals/new" className="btn-primary text-sm px-5 py-2.5 self-start sm:self-auto">
          <Plus size={16} /> New Proposal
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="glass p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your proposals by title or ID..."
            className="input pl-10 py-2.5 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input py-2.5 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Drafts Only</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="input py-2.5 text-sm"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="score_desc">Highest Score</option>
          <option value="updated">Recently Updated</option>
        </select>
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass h-40 animate-pulse" />
          ))}
        </div>
      ) : proposals.length === 0 ? (
        <div className="glass p-12 text-center">
          <FolderKanban className="mx-auto text-white/30 mb-3" size={40} />
          <h3 className="text-base font-semibold text-white mb-1">
            You have no proposals matching this view
          </h3>
          <p className="text-xs text-white/50 max-w-md mx-auto mb-5">
            Create a draft to start working on your solution with your team, or submit directly against a published societal challenge.
          </p>
          <Link to="/proposals/new" className="btn-primary text-xs px-5 py-2.5">
            <Plus size={15} /> Create Solution Proposal
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((prop) => {
            const isDraft = prop.status === "draft";
            const isSubmitted = prop.status === "submitted";
            const isWithdrawn = prop.status === "withdrawn";
            const hasFeedback =
              prop.reviewSummary?.latestFeedback || prop.reviewSummary?.decisionReason;

            return (
              <div
                key={prop.id}
                className="glass p-6 hover:border-primary-500/30 transition flex flex-col gap-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                      <span className="text-xs font-mono text-primary-400 bg-primary-500/10 px-2.5 py-0.5 rounded-md">
                        {prop.proposalCode}
                      </span>
                      <ProposalStatusBadge status={prop.status} />
                      {prop.teamName && (
                        <span className="badge bg-accent-500/15 text-accent-400">
                          Team: {prop.teamName}
                        </span>
                      )}
                      {prop.reviewSummary?.reviewCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full">
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                          Score: {prop.reviewSummary.totalScore}/50 (Avg {prop.reviewSummary.averageScore}/10)
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/proposals/${prop.id}`}
                      className="text-lg font-bold text-white hover:text-primary-300 transition block"
                    >
                      {prop.title}
                    </Link>
                    <p className="text-xs text-white/50 mt-1">
                      Challenge: <span className="text-white/80 font-medium">{prop.challengeTitle}</span> ({prop.challengeCategory}) · Last updated{" "}
                      {new Date(prop.updatedAt).toLocaleString()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      to={`/proposals/${prop.id}`}
                      className="btn-ghost text-xs px-3.5 py-2"
                    >
                      <Eye size={14} /> View Details
                    </Link>

                    {isDraft && (
                      <>
                        <Link
                          to={`/proposals/${prop.id}/edit`}
                          className="btn-ghost text-xs px-3.5 py-2 border-primary-500/40 text-primary-300"
                        >
                          <FileEdit size={14} /> Edit Draft
                        </Link>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: "submit", proposal: prop })}
                          className="btn-primary text-xs px-4 py-2"
                        >
                          <Send size={14} /> Submit Proposal
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ type: "delete", proposal: prop })}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/30 px-3 py-2 rounded-xl transition"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </>
                    )}

                    {isSubmitted && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: "withdraw", proposal: prop })}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/15 px-3.5 py-2 rounded-xl transition"
                      >
                        <RotateCcw size={14} /> Withdraw
                      </button>
                    )}

                    {isWithdrawn && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ type: "reopen", proposal: prop })}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-300 hover:text-primary-200 bg-primary-500/15 border border-primary-500/30 px-3.5 py-2 rounded-xl transition"
                      >
                        <RotateCcw size={14} /> Reopen Draft
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Stepper */}
                <ProposalWorkflowStepper status={prop.status} />

                {/* Reviewer Feedback Banner (if reviewed or decided) */}
                {hasFeedback && (
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-3">
                    <MessageSquare size={16} className="text-primary-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-semibold text-white block mb-0.5">
                        Reviewer Evaluation Feedback:
                      </span>
                      <p className="text-white/70">
                        {prop.reviewSummary.decisionReason || prop.reviewSummary.latestFeedback}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-6 border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="text-amber-400" size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white capitalize">
                  Confirm {confirmAction.type} Proposal
                </h3>
                <p className="text-xs text-white/50">
                  {confirmAction.proposal.proposalCode}
                </p>
              </div>
            </div>

            <p className="text-sm text-white/80 mb-4">
              {confirmAction.type === "delete" &&
                `Are you sure you want to permanently delete the draft "${confirmAction.proposal.title}"? This action cannot be undone.`}
              {confirmAction.type === "submit" &&
                `Once submitted, "${confirmAction.proposal.title}" will be locked from silent editing and queued for official reviewer evaluation.`}
              {confirmAction.type === "withdraw" &&
                `Are you sure you want to withdraw "${confirmAction.proposal.title}" from the evaluation queue?`}
              {confirmAction.type === "reopen" &&
                `Reopen "${confirmAction.proposal.title}" back to Draft status so you can revise and resubmit it?`}
            </p>

            {confirmAction.type === "withdraw" && (
              <div className="mb-4">
                <label className="label">Reason for withdrawal</label>
                <textarea
                  rows={2}
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="input text-xs"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={processing}
                onClick={() => setConfirmAction(null)}
                className="btn-ghost text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleConfirmExecute}
                className={`btn-primary text-xs px-4 py-2 ${
                  confirmAction.type === "delete" ? "bg-rose-600 hover:bg-rose-700" : ""
                }`}
              >
                {processing ? "Processing..." : `Confirm ${confirmAction.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
