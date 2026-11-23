import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ClipboardCheck,
  Search,
  Star,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Award,
  Layers,
  Cpu,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import ProposalStatusBadge from "../../components/proposals/ProposalStatusBadge";
import proposalService from "../../services/proposalService";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_CRITERIA = [
  {
    key: "innovation",
    label: "Innovation and Originality",
    description: "Uniqueness of the proposed approach and creative use of technology or methodology.",
    maxScore: 20,
  },
  {
    key: "feasibility",
    label: "Technical Feasibility",
    description: "Practicality of the implementation plan, engineering soundness, and resource requirements.",
    maxScore: 20,
  },
  {
    key: "societal_impact",
    label: "Societal Impact",
    description: "Measurable benefit to target communities, civic value, and alignment with the challenge.",
    maxScore: 20,
  },
  {
    key: "implementation_strategy",
    label: "Implementation Strategy",
    description: "Milestones, deployment roadmap, prototype readiness, and risk management.",
    maxScore: 20,
  },
  {
    key: "scalability",
    label: "Scalability and Sustainability",
    description: "Long-term viability, maintainability, financial model, and multi-region scalability.",
    maxScore: 20,
  },
];

export default function ReviewQueuePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const preselectedProposalId = searchParams.get("proposalId");

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Active proposal being evaluated in the split-screen rubric workspace
  const [activeProposal, setActiveProposal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [criteriaScores, setCriteriaScores] = useState([]);
  const [overallFeedback, setOverallFeedback] = useState("");
  const [recommendation, setRecommendation] = useState("accept");
  const [savingReview, setSavingReview] = useState(false);
  const [finalizingDecision, setFinalizingDecision] = useState(false);

  const initializeRubricFromProposal = useCallback(
    (proposalDetail) => {
      const existingMyReview = (proposalDetail.reviews || []).find(
        (r) => r.reviewerId === user?.id
      );

      if (existingMyReview && existingMyReview.criteriaScores?.length > 0) {
        setCriteriaScores(
          DEFAULT_CRITERIA.map((base) => {
            const found = existingMyReview.criteriaScores.find((c) => c.key === base.key);
            let s = 16;
            if (found) {
              const raw = Number(found.score);
              s = found.maxScore === 10 ? raw * 2 : raw;
            }
            return {
              key: base.key,
              label: base.label,
              description: base.description,
              maxScore: base.maxScore,
              score: Math.min(20, Math.max(0, s)),
              comment: found?.comment || "",
            };
          })
        );
        setOverallFeedback(existingMyReview.overallFeedback || "");
        setRecommendation(existingMyReview.recommendation || "accept");
      } else {
        setCriteriaScores(
          DEFAULT_CRITERIA.map((base) => ({
            ...base,
            score: 16,
            comment: "",
          }))
        );
        setOverallFeedback("");
        setRecommendation("accept");
      }
    },
    [user?.id]
  );

  const openProposalForEvaluation = useCallback(
    async (proposalId) => {
      try {
        setDetailLoading(true);
        const detail = await proposalService.getProposalById(proposalId);
        setActiveProposal(detail);
        initializeRubricFromProposal(detail);
        setSearchParams({ proposalId });
      } catch (err) {
        toast.error(err.response?.data?.detail || "Could not load proposal for evaluation.");
      } finally {
        setDetailLoading(false);
      }
    },
    [initializeRubricFromProposal, setSearchParams]
  );

  const fetchReviewQueue = useCallback(async () => {
    try {
      setLoading(true);
      const params = { sortBy, limit: 30 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;

      const data = await proposalService.listReviewQueue(params);
      const items = data.items || [];
      setQueue(items);

      if (preselectedProposalId && (!activeProposal || activeProposal.id !== preselectedProposalId)) {
        openProposalForEvaluation(preselectedProposalId);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load review queue.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sortBy, preselectedProposalId, activeProposal, openProposalForEvaluation]);

  useEffect(() => {
    fetchReviewQueue();
  }, [fetchReviewQueue]);

  // Auto-calculated Total Score & Average Score
  const calculatedMetrics = useMemo(() => {
    if (!criteriaScores.length) {
      return { totalScore: 0, maxTotal: 100, averageScore: 0, percentage: 0 };
    }
    const total = criteriaScores.reduce((acc, c) => acc + Number(c.score || 0), 0);
    const maxTotal = criteriaScores.reduce((acc, c) => acc + Number(c.maxScore || 20), 0);
    const avg = Number((total / criteriaScores.length).toFixed(2));
    const pct = Number(((total / maxTotal) * 100).toFixed(1));
    return { totalScore: total, maxTotal, averageScore: avg, percentage: pct };
  }, [criteriaScores]);

  const handleCriterionScoreChange = (key, newScore) => {
    setCriteriaScores((prev) =>
      prev.map((c) => (c.key === key ? { ...c, score: Number(newScore) } : c))
    );
  };

  const handleCriterionCommentChange = (key, newComment) => {
    setCriteriaScores((prev) =>
      prev.map((c) => (c.key === key ? { ...c, comment: newComment } : c))
    );
  };

  const handleSaveOrSubmitReview = async (submitFinal) => {
    if (!activeProposal) return;
    if (!overallFeedback || overallFeedback.trim().length < 5) {
      toast.error("Please provide written overall evaluation feedback (at least 5 characters).");
      return;
    }

    try {
      setSavingReview(true);
      await proposalService.upsertReview(activeProposal.id, {
        criteriaScores: criteriaScores.map((c) => ({
          key: c.key,
          label: c.label,
          score: Number(c.score),
          maxScore: Number(c.maxScore || 20),
          comment: c.comment || "",
        })),
        overallFeedback: overallFeedback.trim(),
        recommendation,
        submitFinal,
      });

      toast.success(
        submitFinal
          ? "Official rubric evaluation submitted!"
          : "Evaluation draft saved!"
      );

      // Refresh active proposal & queue
      const updated = await proposalService.getProposalById(activeProposal.id);
      setActiveProposal(updated);
      fetchReviewQueue();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save evaluation.");
    } finally {
      setSavingReview(false);
    }
  };

  const handleFinalizeDecision = async (targetDecisionStatus) => {
    if (!activeProposal) return;
    const reason =
      overallFeedback.trim().length >= 5
        ? overallFeedback.trim()
        : window.prompt(
            `Enter official decision feedback for marking this proposal as ${targetDecisionStatus.toUpperCase()}:`,
            `Evaluated via rubric (${calculatedMetrics.totalScore}/50).`
          );

    if (!reason || reason.trim().length < 5) {
      toast.error("A decision feedback comment (at least 5 characters) is required.");
      return;
    }

    try {
      setFinalizingDecision(true);
      const updated = await proposalService.changeStatus(
        activeProposal.id,
        targetDecisionStatus,
        reason.trim()
      );
      toast.success(`Proposal officially marked as ${targetDecisionStatus.toUpperCase()}!`);
      setActiveProposal(updated);
      fetchReviewQueue();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not finalize decision.");
    } finally {
      setFinalizingDecision(false);
    }
  };

  const currentQueueIndex = activeProposal
    ? queue.findIndex((item) => item.id === activeProposal.id)
    : -1;

  return (
    <DashboardLayout title="Proposal Evaluation & Grading Rubric">
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
            <ClipboardCheck size={22} className="text-amber-400" />
            Reviewer Evaluation Workspace & Queue
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Evaluate submitted proposals using the 5-criterion grading rubric, provide actionable feedback, and recommend acceptance or rejection.
          </p>
        </div>

        {activeProposal && (
          <button
            type="button"
            onClick={() => {
              setActiveProposal(null);
              setSearchParams({});
            }}
            className="btn-ghost text-xs px-4 py-2 self-start sm:self-auto"
          >
            <ArrowLeft size={14} /> Return to Queue List ({queue.length})
          </button>
        )}
      </div>

      {/* SPLIT-VIEW RUBRIC EVALUATION MODE */}
      {activeProposal ? (
        <div className="space-y-4">
          {/* Top Navigation Bar Between Applications (like Reference Screenshot) */}
          <div className="glass px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-primary-400 bg-primary-500/15 px-2.5 py-1 rounded-md">
                {activeProposal.proposalCode}
              </span>
              <ProposalStatusBadge status={activeProposal.status} />
              <span className="text-xs text-white/60">
                By <strong className="text-white">{activeProposal.authorName}</strong>
                {activeProposal.teamName ? ` (${activeProposal.teamName})` : ""}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {currentQueueIndex >= 0 && (
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <span>
                    Proposal {currentQueueIndex + 1} of {queue.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentQueueIndex <= 0}
                    onClick={() => openProposalForEvaluation(queue[currentQueueIndex - 1].id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    disabled={currentQueueIndex >= queue.length - 1}
                    onClick={() => openProposalForEvaluation(queue[currentQueueIndex + 1].id)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}

              <Link
                to={`/proposals/${activeProposal.id}`}
                className="text-xs text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 font-medium"
              >
                Full Details Page <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          {detailLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="glass lg:col-span-7 h-[640px] animate-pulse" />
              <div className="glass lg:col-span-5 h-[640px] animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT PANE: Proposal Document Reader */}
              <div className="glass p-6 lg:col-span-7 space-y-6 max-h-[82vh] overflow-y-auto">
                <div className="pb-4 border-b border-white/10">
                  <span className="badge bg-primary-500/20 text-primary-300 mb-2">
                    {activeProposal.challengeCategory} · {activeProposal.challengeTitle}
                  </span>
                  <h1 className="text-xl font-bold text-white">{activeProposal.title}</h1>
                  <p className="text-xs text-white/50 mt-1">
                    Submitted:{" "}
                    {activeProposal.submittedAt
                      ? new Date(activeProposal.submittedAt).toLocaleString()
                      : new Date(activeProposal.createdAt).toLocaleString()}{" "}
                    · Timeline: {activeProposal.estimatedTimeline || "N/A"}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-primary-300 mb-1.5 flex items-center gap-2">
                      <Layers size={15} /> 1. Problem Understanding
                    </h3>
                    <p className="text-sm text-white/80 whitespace-pre-line leading-relaxed bg-white/5 p-4 rounded-xl">
                      {activeProposal.problemUnderstanding || "Not provided."}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-accent-400 mb-1.5">
                      2. Proposed Solution & Innovation
                    </h3>
                    <div className="bg-white/5 p-4 rounded-xl space-y-3 text-sm text-white/80">
                      <p className="whitespace-pre-line leading-relaxed">
                        {activeProposal.proposedSolution || "Not provided."}
                      </p>
                      {activeProposal.innovationUniqueness && (
                        <div className="pt-2 border-t border-white/10">
                          <span className="text-xs font-semibold text-white block mb-1">
                            Innovation & Uniqueness:
                          </span>
                          <p className="text-xs text-white/75 whitespace-pre-line">
                            {activeProposal.innovationUniqueness}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-violet-300 mb-1.5 flex items-center gap-2">
                      <Cpu size={15} /> 3. Technical Approach & Implementation Plan
                    </h3>
                    <div className="bg-white/5 p-4 rounded-xl space-y-3 text-sm text-white/80">
                      <div>
                        <span className="text-xs font-semibold text-white block mb-1">
                          Technical Architecture:
                        </span>
                        <p className="text-xs text-white/75 whitespace-pre-line leading-relaxed">
                          {activeProposal.technicalApproach || "Not provided."}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <span className="text-xs font-semibold text-white block mb-1">
                          Implementation Plan:
                        </span>
                        <p className="text-xs text-white/75 whitespace-pre-line leading-relaxed">
                          {activeProposal.implementationPlan || "Not provided."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-xs font-semibold text-amber-300 block mb-1">
                        Required Resources
                      </span>
                      <p className="text-xs text-white/75">
                        {activeProposal.requiredResources || "Not specified."}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-xs font-semibold text-emerald-300 block mb-1">
                        Expected Societal Impact
                      </span>
                      <p className="text-xs text-white/75">
                        {activeProposal.expectedImpact || "Not specified."}
                      </p>
                    </div>
                  </div>

                  {/* Links & Documents */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <span className="text-xs font-semibold text-white block">
                      Prototype Links & Supporting Documents
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {activeProposal.prototypeUrl && (
                        <a
                          href={activeProposal.prototypeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost text-xs px-3 py-1.5"
                        >
                          Prototype URL <ExternalLink size={12} />
                        </a>
                      )}
                      {activeProposal.githubUrl && (
                        <a
                          href={activeProposal.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost text-xs px-3 py-1.5"
                        >
                          GitHub Repo <ExternalLink size={12} />
                        </a>
                      )}
                      {activeProposal.demoUrl && (
                        <a
                          href={activeProposal.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost text-xs px-3 py-1.5"
                        >
                          Live Demo <ExternalLink size={12} />
                        </a>
                      )}
                      {(activeProposal.supportingDocuments || []).map((doc, idx) => (
                        <a
                          key={idx}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost text-xs px-3 py-1.5"
                        >
                          <FileText size={12} /> {doc.name}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT PANE: Interactive Grading Rubric */}
              <div className="glass p-6 lg:col-span-5 space-y-5 border-primary-500/30">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Award size={18} className="text-amber-400" />
                      Grading Rubric
                    </h3>
                    <p className="text-xs text-white/50">
                      Score 5 criteria from 0 to 20 points (Total maximum score: 100).
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-extrabold text-amber-300">
                      {calculatedMetrics.totalScore} / {calculatedMetrics.maxTotal}
                    </span>
                    <span className="block text-[11px] text-accent-400 font-semibold">
                      {calculatedMetrics.percentage}% · Avg {calculatedMetrics.averageScore} / 20
                    </span>
                  </div>
                </div>

                {/* 5 Rubric Criteria */}
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                  {criteriaScores.map((crit, index) => (
                    <div
                      key={crit.key}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-primary-500/25 text-primary-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-semibold text-white">{crit.label}</h4>
                            <p className="text-[11px] text-white/50 leading-snug">
                              {crit.description}
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-lg bg-primary-500/20 text-primary-300 font-bold text-xs shrink-0">
                          {crit.score} / {crit.maxScore || 20}
                        </span>
                      </div>

                      {/* Interactive 0-20 Range Slider + Stepper + Preset Benchmarks */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max={crit.maxScore || 20}
                            step="1"
                            value={crit.score}
                            onChange={(e) => handleCriterionScoreChange(crit.key, e.target.value)}
                            className="w-full accent-primary-500 cursor-pointer h-2 bg-dark-800 rounded-lg"
                          />
                          <input
                            type="number"
                            min="0"
                            max={crit.maxScore || 20}
                            value={crit.score}
                            onChange={(e) =>
                              handleCriterionScoreChange(
                                crit.key,
                                Math.max(0, Math.min(crit.maxScore || 20, Number(e.target.value) || 0))
                              )
                            }
                            className="input w-16 py-1 px-2 text-center text-xs font-bold shrink-0"
                          />
                        </div>

                        {/* Benchmark Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {[
                            { label: "Fair (8)", val: 8 },
                            { label: "Adequate (12)", val: 12 },
                            { label: "Strong (16)", val: 16 },
                            { label: "Exemplary (18)", val: 18 },
                            { label: "Max (20)", val: 20 },
                          ].map((b) => (
                            <button
                              key={b.val}
                              type="button"
                              onClick={() => handleCriterionScoreChange(crit.key, b.val)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                                Number(crit.score) === b.val
                                  ? "bg-primary-500 text-white"
                                  : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={crit.comment}
                        onChange={(e) => handleCriterionCommentChange(crit.key, e.target.value)}
                        placeholder={`Optional comment on ${crit.label.toLowerCase()}...`}
                        className="input py-1.5 px-3 text-xs"
                      />
                    </div>
                  ))}
                </div>

                {/* Recommendation & Overall Feedback */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div>
                    <label className="label text-xs">Reviewer Recommendation</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: "accept", label: "Recommend Accept", cls: "border-emerald-500/40 text-emerald-300 bg-emerald-500/15" },
                        { val: "revise", label: "Needs Revision", cls: "border-amber-500/40 text-amber-300 bg-amber-500/15" },
                        { val: "reject", label: "Recommend Reject", cls: "border-rose-500/40 text-rose-300 bg-rose-500/15" },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setRecommendation(opt.val)}
                          className={`py-2 px-2 rounded-xl text-xs font-semibold border transition ${
                            recommendation === opt.val
                              ? opt.cls
                              : "border-white/10 bg-white/5 text-white/50 hover:text-white"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs">
                      Written Evaluation Feedback <span className="text-rose-400">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={overallFeedback}
                      onChange={(e) => setOverallFeedback(e.target.value)}
                      placeholder="Summarize strengths, technical feasibility, and actionable recommendations for the team..."
                      className="input text-xs"
                    />
                  </div>

                  {/* Total Auto-Calculated Score Banner */}
                  <div className="p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/25 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Total Auto-Calculated Score: {calculatedMetrics.totalScore} / {calculatedMetrics.maxTotal}
                      </span>
                      <span className="text-[11px] text-white/60">
                        Average Score: {calculatedMetrics.averageScore} / 10 ({calculatedMetrics.percentage}%)
                      </span>
                    </div>
                  </div>

                  {/* Save Review Draft & Submit Official Review Buttons */}
                  {activeProposal.permissions?.canReview ? (
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={savingReview}
                        onClick={() => handleSaveOrSubmitReview(false)}
                        className="btn-ghost text-xs px-4 py-2.5 flex-1"
                      >
                        <Save size={14} /> Save Draft
                      </button>
                      <button
                        type="button"
                        disabled={savingReview}
                        onClick={() => handleSaveOrSubmitReview(true)}
                        className="btn-primary text-xs px-4 py-2.5 flex-1"
                      >
                        <Send size={14} /> Submit Review
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl">
                      This proposal is currently in <strong>{activeProposal.status}</strong> status or authored by your team, so rubric edits are locked.
                    </p>
                  )}

                  {/* Finalize Proposal Status Decision (Accept / Reject) */}
                  {activeProposal.permissions?.canChangeStatus && (
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
                        Official Status Workflow Decision
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          disabled={finalizingDecision || activeProposal.status !== "under_review"}
                          onClick={() => handleFinalizeDecision("accepted")}
                          title={
                            activeProposal.status !== "under_review"
                              ? "Submit a review or move proposal to Under Review first"
                              : "Mark proposal as Accepted"
                          }
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition disabled:opacity-40"
                        >
                          <CheckCircle2 size={14} /> Accept Proposal
                        </button>
                        <button
                          type="button"
                          disabled={finalizingDecision || activeProposal.status !== "under_review"}
                          onClick={() => handleFinalizeDecision("rejected")}
                          title={
                            activeProposal.status !== "under_review"
                              ? "Submit a review or move proposal to Under Review first"
                              : "Mark proposal as Rejected"
                          }
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition disabled:opacity-40"
                        >
                          <XCircle size={14} /> Reject Proposal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* QUEUE TABLE VIEW */
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="glass p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reviewable proposals by title, ID, or author..."
                className="input pl-10 py-2.5 text-sm"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-2.5 text-sm"
            >
              <option value="all">All Reviewable Statuses</option>
              <option value="submitted">Submitted (Awaiting Review)</option>
              <option value="under_review">Under Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input py-2.5 text-sm"
            >
              <option value="newest">Newest Submissions</option>
              <option value="oldest">Oldest Submissions</option>
              <option value="score_desc">Highest Score</option>
              <option value="score_asc">Lowest Score</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="glass h-24 animate-pulse" />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="glass p-12 text-center">
              <ClipboardCheck size={40} className="mx-auto text-white/30 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                No proposals currently in the review queue
              </h3>
              <p className="text-xs text-white/50 max-w-md mx-auto">
                Submitted proposals from other students and teams will appear here for evaluation. (Note: Your own proposals are excluded to prevent self-review.)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((prop) => (
                <div
                  key={prop.id}
                  className="glass p-5 hover:border-primary-500/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-primary-400">
                        {prop.proposalCode}
                      </span>
                      <ProposalStatusBadge status={prop.status} />
                      <span className="badge bg-white/10 text-white/70 text-[10px]">
                        {prop.challengeCategory}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white truncate">
                      {prop.title}
                    </h3>
                    <p className="text-xs text-white/50">
                      Challenge: <span className="text-white/80">{prop.challengeTitle}</span> · Submitted by{" "}
                      <span className="text-white/80 font-medium">{prop.authorName}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {prop.reviewSummary?.reviewCount > 0 && (
                      <div className="text-right mr-2">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                          <Star size={13} className="fill-amber-400 text-amber-400" />
                          {prop.reviewSummary.totalScore}/50
                        </span>
                        <span className="block text-[11px] text-white/40">
                          Avg {prop.reviewSummary.averageScore}/10
                        </span>
                      </div>
                    )}

                    <Link
                      to={`/proposals/${prop.id}`}
                      className="btn-ghost text-xs px-3.5 py-2"
                    >
                      Details
                    </Link>

                    <button
                      type="button"
                      onClick={() => openProposalForEvaluation(prop.id)}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      <ClipboardCheck size={14} /> Open Grading Rubric
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
