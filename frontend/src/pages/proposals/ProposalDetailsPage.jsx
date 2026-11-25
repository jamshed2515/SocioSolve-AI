import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  FileEdit,
  Send,
  Trash2,
  RotateCcw,
  ExternalLink,
  GitBranch,
  Globe,
  FileText,
  Users,
  Calendar,
  Clock,
  Star,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  History,
  Layers,
  Cpu,
  Sparkles,
  Award,
  MessageSquare,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import ProposalStatusBadge, { ProposalWorkflowStepper } from "../../components/proposals/ProposalStatusBadge";
import proposalService from "../../services/proposalService";

const BACKEND_ORIGIN = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");

export default function ProposalDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [processing, setProcessing] = useState(false);

  // Admin / Reviewer quick decision modal state
  const [decisionModal, setDecisionModal] = useState(null); // 'under_review' | 'accepted' | 'rejected'
  const [decisionComment, setDecisionComment] = useState("");

  const loadProposal = useCallback(async () => {
    try {
      setLoading(true);
      const data = await proposalService.getProposalById(id);
      setProposal(data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load proposal details.");
      navigate("/proposals");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadProposal();
  }, [loadProposal]);

  const handleSubmitDraft = async () => {
    try {
      setProcessing(true);
      await proposalService.submitProposal(id);
      toast.success("Proposal submitted for evaluation!");
      loadProposal();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit proposal.");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this draft proposal?")) return;
    try {
      setProcessing(true);
      await proposalService.deleteDraftProposal(id);
      toast.success("Draft deleted.");
      navigate("/proposals/my");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete draft.");
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    const reason = window.prompt("Enter reason for withdrawing this proposal:", "Withdrawing to revise technical plan.");
    if (reason === null) return;
    try {
      setProcessing(true);
      await proposalService.withdrawProposal(id, reason);
      toast.success("Proposal withdrawn.");
      loadProposal();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to withdraw proposal.");
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusTransition = async () => {
    if (!decisionModal) return;
    if ((decisionModal === "accepted" || decisionModal === "rejected") && decisionComment.trim().length < 5) {
      toast.error("Please provide a decision feedback/reason (at least 5 characters).");
      return;
    }

    try {
      setProcessing(true);
      await proposalService.changeStatus(
        id,
        decisionModal,
        decisionComment.trim() || `Status updated to ${decisionModal}`
      );
      toast.success(`Proposal status updated to ${decisionModal.replace("_", " ")}!`);
      setDecisionModal(null);
      setDecisionComment("");
      loadProposal();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update proposal status.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !proposal) {
    return (
      <DashboardLayout title="Proposal Details">
        <div className="space-y-4">
          <div className="glass h-40 animate-pulse" />
          <div className="glass h-96 animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  const perms = proposal.permissions || {};
  const summary = proposal.reviewSummary || {};
  const reviews = proposal.reviews || [];
  const history = proposal.statusHistory || [];

  const resolveDocUrl = (url) => {
    if (!url) return "#";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `${BACKEND_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const tabs = [
    { key: "overview", label: "Solution Overview", icon: Layers },
    { key: "technical", label: "Technical & Implementation Plan", icon: Cpu },
    { key: "resources", label: "Prototype & Documents", icon: FileText },
    {
      key: "reviews",
      label: `Evaluations & Feedback (${reviews.length})`,
      icon: Award,
    },
    {
      key: "history",
      label: `Status History (${history.length})`,
      icon: History,
    },
  ];

  return (
    <DashboardLayout title="Proposal Details">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Navigation & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Link
            to="/proposals"
            className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white"
          >
            <ArrowLeft size={15} /> Back to Proposal Dashboard
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            {perms.canEdit && (
              <Link
                to={`/proposals/${proposal.id}/edit`}
                className="btn-ghost text-xs px-4 py-2 border-primary-500/40 text-primary-300"
              >
                <FileEdit size={14} /> Edit Draft
              </Link>
            )}
            {perms.canSubmit && (
              <button
                type="button"
                disabled={processing}
                onClick={handleSubmitDraft}
                className="btn-primary text-xs px-4 py-2"
              >
                <Send size={14} /> Submit Proposal
              </button>
            )}
            {perms.canDelete && (
              <button
                type="button"
                disabled={processing}
                onClick={handleDeleteDraft}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 px-3.5 py-2 rounded-xl transition"
              >
                <Trash2 size={14} /> Delete Draft
              </button>
            )}
            {perms.canWithdraw && (
              <button
                type="button"
                disabled={processing}
                onClick={handleWithdraw}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-3.5 py-2 rounded-xl transition"
              >
                <RotateCcw size={14} /> Withdraw Proposal
              </button>
            )}
            {perms.canReview && (
              <Link
                to={`/proposals/review-queue?proposalId=${proposal.id}`}
                className="btn-primary text-xs px-4 py-2 bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
              >
                <ClipboardCheck size={14} /> Evaluate with Rubric
              </Link>
            )}
            {perms.canChangeStatus && proposal.status === "submitted" && (
              <button
                type="button"
                onClick={() => {
                  setDecisionModal("under_review");
                  setDecisionComment("Proposal assigned and moved to Under Review.");
                }}
                className="btn-ghost text-xs px-3.5 py-2 border-amber-500/40 text-amber-300"
              >
                <Clock size={14} /> Start Review
              </button>
            )}
            {perms.canChangeStatus && proposal.status === "under_review" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionModal("accepted");
                    setDecisionComment(summary.latestFeedback || "");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3.5 py-2 rounded-xl transition"
                >
                  <CheckCircle2 size={14} /> Accept Proposal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDecisionModal("rejected");
                    setDecisionComment(summary.latestFeedback || "");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3.5 py-2 rounded-xl transition"
                >
                  <XCircle size={14} /> Reject Proposal
                </button>
              </>
            )}
          </div>
        </div>

        {/* Hero Summary Card */}
        <div className="glass p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-mono font-semibold text-primary-300 bg-primary-500/15 px-3 py-1 rounded-lg">
                  {proposal.proposalCode}
                </span>
                <span className="text-[11px] font-mono text-white/40">
                  ID: {proposal.id}
                </span>
                <ProposalStatusBadge status={proposal.status} size="lg" />
              </div>

              <h1 className="text-2xl font-bold text-white leading-snug">
                {proposal.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-white/60 pt-1">
                <span>
                  Challenge:{" "}
                  <strong className="text-white">{proposal.challengeTitle}</strong>{" "}
                  <span className="badge bg-white/10 text-white/70 ml-1 text-[10px]">
                    {proposal.challengeCategory}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar size={13} className="text-primary-400" />
                  Submitted:{" "}
                  {proposal.submittedAt
                    ? new Date(proposal.submittedAt).toLocaleString()
                    : "Not yet submitted (Draft)"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} className="text-accent-400" />
                  Updated: {new Date(proposal.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Score Summary Box */}
            <div className="p-4 rounded-2xl bg-dark-800/90 border border-white/10 min-w-[210px] text-center">
              <p className="text-[11px] uppercase tracking-wider text-white/50 mb-1">
                Evaluation Score
              </p>
              {summary.reviewCount > 0 ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 text-2xl font-extrabold text-amber-300">
                    <Star size={20} className="fill-amber-400 text-amber-400" />
                    {summary.totalScore}
                    <span className="text-sm font-normal text-white/40">/ 50</span>
                  </div>
                  <p className="text-xs text-accent-400 font-medium mt-0.5">
                    Avg Criterion: {summary.averageScore}/10 ({summary.percentageScore}%)
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    Based on {summary.reviewCount} official review(s)
                  </p>
                </>
              ) : (
                <p className="text-xs text-white/40 py-2">Awaiting Evaluation</p>
              )}
            </div>
          </div>

          {/* Controlled Workflow Progress Bar */}
          <div className="pt-2 border-t border-white/10">
            <ProposalWorkflowStepper status={proposal.status} />
          </div>

          {/* Official Decision Banner (if Accepted or Rejected) */}
          {(proposal.status === "accepted" || proposal.status === "rejected") && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                proposal.status === "accepted"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-200"
              }`}
            >
              {proposal.status === "accepted" ? (
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-white">
                  Official Evaluation Decision:{" "}
                  {proposal.status === "accepted" ? "ACCEPTED" : "REJECTED"}
                </p>
                {summary.decisionReason && (
                  <p className="text-white/85 leading-relaxed">
                    <strong>Reviewer / Committee Feedback:</strong> {summary.decisionReason}
                  </p>
                )}
                {summary.decisionByName && (
                  <p className="text-white/50 text-[11px]">
                    Decided by {summary.decisionByName} on{" "}
                    {summary.decisionAt ? new Date(summary.decisionAt).toLocaleString() : ""}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Author & Team Info Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
              Submitted By
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500/20 border border-primary-500/40 flex items-center justify-center font-bold text-primary-300">
                {proposal.authorName?.[0]?.toUpperCase() || "U"}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{proposal.authorName}</p>
                <p className="text-xs text-white/50">{proposal.authorEmail}</p>
                <span className="badge bg-white/10 text-white/70 text-[10px] mt-1 uppercase">
                  {proposal.authorRole}
                </span>
              </div>
            </div>
          </div>

          <div className="glass p-5 md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                <Users size={14} className="text-violet-400" />
                Team & Collaborators {proposal.teamName ? `— ${proposal.teamName}` : ""}
              </h3>
              <span className="text-xs text-white/40">
                {(proposal.teamMembers || []).length} Co-Member(s)
              </span>
            </div>

            {(proposal.teamMembers || []).length === 0 ? (
              <p className="text-xs text-white/50">
                Submitted as an individual proposer (no additional team members listed).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {proposal.teamMembers.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{m.name}</p>
                      {m.email && <p className="text-white/40 text-[11px]">{m.email}</p>}
                    </div>
                    <span className="badge bg-violet-500/20 text-violet-300 text-[10px]">
                      {m.roleInTeam || "Member"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === key
                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab 1: Solution Overview */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass p-6 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers size={17} className="text-primary-400" />
                Problem Understanding
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
                {proposal.problemUnderstanding || "Not specified yet."}
              </p>
            </div>

            <div className="glass p-6 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles size={17} className="text-accent-400" />
                Proposed Solution
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
                {proposal.proposedSolution || "Not specified yet."}
              </p>
            </div>

            <div className="glass p-6 space-y-3">
              <h3 className="text-base font-bold text-white">
                Innovation & Uniqueness
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
                {proposal.innovationUniqueness || "Not specified yet."}
              </p>
            </div>

            <div className="glass p-6 space-y-3">
              <h3 className="text-base font-bold text-white">
                Expected Societal Impact
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
                {proposal.expectedImpact || "Not specified yet."}
              </p>
            </div>

            {proposal.additionalNotes && (
              <div className="glass p-6 lg:col-span-2 space-y-2">
                <h3 className="text-sm font-bold text-white">Additional Notes</h3>
                <p className="text-sm text-white/70 whitespace-pre-line">
                  {proposal.additionalNotes}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Technical & Implementation Plan */}
        {activeTab === "technical" && (
          <div className="space-y-6">
            <div className="glass p-6 space-y-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Cpu size={17} className="text-primary-400" />
                Technical Approach & System Architecture
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
                {proposal.technicalApproach || "Not specified yet."}
              </p>
            </div>

            <div className="glass p-6 space-y-3">
              <h3 className="text-base font-bold text-white">
                Implementation Plan & Milestones
              </h3>
              <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed">
                {proposal.implementationPlan || "Not specified yet."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass p-6 space-y-2">
                <h4 className="text-sm font-bold text-accent-400">
                  Estimated Implementation Timeline
                </h4>
                <p className="text-sm text-white/80 whitespace-pre-line">
                  {proposal.estimatedTimeline || "Not specified yet."}
                </p>
              </div>

              <div className="glass p-6 space-y-2">
                <h4 className="text-sm font-bold text-amber-300">
                  Required Resources & Support
                </h4>
                <p className="text-sm text-white/80 whitespace-pre-line">
                  {proposal.requiredResources || "Not specified yet."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Prototype Links & Supporting Documents */}
        {activeTab === "resources" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass p-6 space-y-4">
              <h3 className="text-base font-bold text-white">
                Prototype, Repository & Live Demo Links
              </h3>

              <div className="space-y-3">
                {proposal.prototypeUrl ? (
                  <a
                    href={proposal.prototypeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Globe size={18} className="text-primary-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-white">Interactive Prototype URL</p>
                        <p className="text-xs text-primary-300 truncate">{proposal.prototypeUrl}</p>
                      </div>
                    </div>
                    <ExternalLink size={15} className="text-white/50 shrink-0" />
                  </a>
                ) : (
                  <div className="p-4 rounded-xl bg-white/5 text-xs text-white/40">
                    No prototype URL provided.
                  </div>
                )}

                {proposal.githubUrl ? (
                  <a
                    href={proposal.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <GitBranch size={18} className="text-white shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-white">GitHub Source Repository</p>
                        <p className="text-xs text-primary-300 truncate">{proposal.githubUrl}</p>
                      </div>
                    </div>
                    <ExternalLink size={15} className="text-white/50 shrink-0" />
                  </a>
                ) : (
                  <div className="p-4 rounded-xl bg-white/5 text-xs text-white/40">
                    No GitHub repository URL provided.
                  </div>
                )}

                {proposal.demoUrl ? (
                  <a
                    href={proposal.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ExternalLink size={18} className="text-accent-400 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-white">Live Demo / Video Walkthrough</p>
                        <p className="text-xs text-accent-300 truncate">{proposal.demoUrl}</p>
                      </div>
                    </div>
                    <ExternalLink size={15} className="text-white/50 shrink-0" />
                  </a>
                ) : (
                  <div className="p-4 rounded-xl bg-white/5 text-xs text-white/40">
                    No live demo URL provided.
                  </div>
                )}
              </div>
            </div>

            <div className="glass p-6 space-y-4">
              <h3 className="text-base font-bold text-white">
                Attached Supporting Documents ({(proposal.supportingDocuments || []).length})
              </h3>

              {(proposal.supportingDocuments || []).length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-white/5 text-xs text-white/40">
                  No supporting documents or implementation plan files attached.
                </div>
              ) : (
                <div className="space-y-3">
                  {proposal.supportingDocuments.map((doc, idx) => (
                    <a
                      key={idx}
                      href={resolveDocUrl(doc.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText size={18} className="text-primary-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-semibold text-white truncate">{doc.name}</p>
                          <p className="text-[11px] text-white/50 uppercase">
                            {doc.docType || "Document"}
                            {doc.sizeBytes ? ` · ${(doc.sizeBytes / 1024).toFixed(1)} KB` : ""}
                          </p>
                        </div>
                      </div>
                      <ExternalLink size={15} className="text-primary-400 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Evaluations, Rubric Breakdown & Reviewer Feedback */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <div className="glass p-10 text-center">
                <Award size={36} className="mx-auto text-white/30 mb-3" />
                <h3 className="text-base font-semibold text-white mb-1">
                  No Official Evaluations Submitted Yet
                </h3>
                <p className="text-xs text-white/50 max-w-md mx-auto">
                  When authorized university/industry reviewers evaluate this proposal using the 5-criterion rubric, their scores and written feedback will appear here.
                </p>
                {perms.canReview && (
                  <Link
                    to={`/proposals/review-queue?proposalId=${proposal.id}`}
                    className="btn-primary text-xs px-5 py-2.5 mt-4"
                  >
                    <ClipboardCheck size={15} /> Evaluate This Proposal Now
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map((rev) => (
                  <div key={rev.id} className="glass p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{rev.reviewerName}</span>
                          <span className="badge bg-white/10 text-white/70 text-[10px] uppercase">
                            {rev.reviewerRole}
                          </span>
                          {rev.status === "draft" && (
                            <span className="badge bg-amber-500/20 text-amber-300 text-[10px]">
                              Draft Review (Visible only to you)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          Evaluated on {new Date(rev.submittedAt || rev.updatedAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`badge uppercase text-xs ${
                            rev.recommendation === "accept"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : rev.recommendation === "reject"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          Recommendation: {rev.recommendation}
                        </span>
                        <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-sm">
                          {rev.totalScore} / {rev.maxTotalScore || 100} ({rev.percentageScore || ((rev.totalScore / (rev.maxTotalScore || 100)) * 100).toFixed(0)}%)
                        </div>
                      </div>
                    </div>

                    {/* Rubric Criteria Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {(rev.criteriaScores || []).map((crit) => (
                        <div
                          key={crit.key}
                          className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-white">{crit.label}</span>
                              <span className="text-xs font-bold text-primary-300">
                                {crit.score}/{crit.maxScore || 20}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                              <div
                                className="h-full bg-primary-500 rounded-full"
                                style={{ width: `${((crit.score || 0) / (crit.maxScore || 20)) * 100}%` }}
                              />
                            </div>
                          </div>
                          {crit.comment && (
                            <p className="text-[11px] text-white/60 italic">"{crit.comment}"</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Written Overall Feedback */}
                    <div className="p-4 rounded-xl bg-dark-800 border border-white/10">
                      <p className="text-xs font-semibold text-white/60 mb-1 flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-primary-400" />
                        Written Evaluation Feedback
                      </p>
                      <p className="text-sm text-white/85 whitespace-pre-line">
                        {rev.overallFeedback}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Immutable Evaluation Revision History */}
                {(proposal.reviewHistory || []).length > 1 && (
                  <div className="glass p-6 space-y-4 border-amber-500/20">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Award size={16} className="text-amber-400" />
                      Evaluation Audit History & Revisions ({(proposal.reviewHistory || []).length} events)
                    </h4>
                    <div className="space-y-3">
                      {(proposal.reviewHistory || []).map((entry, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1.5">
                          <div className="flex items-center justify-between text-white/70">
                            <span className="font-semibold text-white">
                              {entry.reviewerName} ({entry.reviewerRole}) — <span className="capitalize text-primary-300">{entry.action?.replace("_", " ")}</span>
                            </span>
                            <span className="text-white/40">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-300">
                              Score: {entry.totalScore} / {entry.maxTotalScore || 100} ({entry.percentageScore}%)
                            </span>
                            <span className="badge bg-white/10 text-white/70 uppercase text-[10px]">
                              {entry.recommendation}
                            </span>
                          </div>
                          {entry.overallFeedback && (
                            <p className="text-white/60 italic whitespace-pre-line">"{entry.overallFeedback}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Status History Audit Trail */}
        {activeTab === "history" && (
          <div className="glass p-6">
            <h3 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <History size={18} className="text-primary-400" />
              Proposal Status Workflow History
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-white/50">No status history recorded.</p>
            ) : (
              <div className="relative pl-6 border-l-2 border-primary-500/30 space-y-6">
                {history.map((item, idx) => (
                  <div key={item.id || idx} className="relative">
                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-dark-900 border-2 border-primary-400" />
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {item.fromStatus && (
                            <>
                              <ProposalStatusBadge status={item.fromStatus} />
                              <span className="text-xs text-white/40">→</span>
                            </>
                          )}
                          <ProposalStatusBadge status={item.toStatus} />
                        </div>
                        <span className="text-xs text-white/40">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs text-white/80">
                        Changed by <strong className="text-white">{item.changedByName}</strong>{" "}
                        <span className=" uppercase text-[10px] text-white/50">
                          ({item.changedByRole})
                        </span>
                        {item.scoreSnapshot ? ` · Score at decision: ${item.scoreSnapshot}/50` : ""}
                      </p>

                      {item.comment && (
                        <p className="text-xs text-white/60 bg-dark-800/80 p-2.5 rounded-lg mt-1">
                          {item.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reviewer / Admin Status Decision Modal */}
      {decisionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-6 border-white/20 space-y-4">
            <h3 className="text-base font-bold text-white capitalize">
              Confirm Status Transition: {decisionModal.replace("_", " ")}
            </h3>
            <p className="text-xs text-white/60">
              Proposal: <strong className="text-white">{proposal.title}</strong> ({proposal.proposalCode})
            </p>

            <div>
              <label className="label">
                Official Reviewer Feedback / Decision Note{" "}
                {(decisionModal === "accepted" || decisionModal === "rejected") && (
                  <span className="text-rose-400">*</span>
                )}
              </label>
              <textarea
                rows={4}
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder="Provide clear evaluation reasoning and next steps for the proposing team..."
                className="input text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => setDecisionModal(null)}
                className="btn-ghost text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleStatusTransition}
                className={`btn-primary text-xs px-5 py-2 ${
                  decisionModal === "accepted"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : decisionModal === "rejected"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : ""
                }`}
              >
                {processing ? "Updating..." : "Confirm Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
