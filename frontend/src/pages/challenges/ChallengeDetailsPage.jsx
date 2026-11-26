import React, { useState, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Eye,
  FileText,
  Clock,
  Sparkles,
  User,
  Shield,
  Edit3,
  Trash2,
  Download,
  Users,
  Lightbulb,
  AlertCircle,
  File,
  Image as ImageIcon,
  Archive,
  Tag,
  Settings,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import ChallengeStatusBadge from "../../components/challenges/ChallengeStatusBadge";
import challengeService from "../../services/challengeService";
import { useAuth } from "../../context/AuthContext";

const DIFFICULTY_STYLES = {
  Easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Hard: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getAttachmentIcon(name = "") {
  const ext = name.substring(name.lastIndexOf(".")).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return <ImageIcon size={20} className="text-cyan-400 shrink-0" />;
  }
  if ([".doc", ".docx"].includes(ext)) {
    return <FileText size={20} className="text-blue-400 shrink-0" />;
  }
  if ([".zip"].includes(ext)) {
    return <Archive size={20} className="text-amber-400 shrink-0" />;
  }
  return <File size={20} className="text-primary-400 shrink-0" />;
}

export default function ChallengeDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchChallenge = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await challengeService.getChallengeById(id);
      setChallenge(data);
      setNewStatus(data.status);
    } catch (err) {
      console.error("Failed to fetch challenge details:", err);
      const msg = err.response?.data?.detail || "Challenge not found or could not be loaded.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchChallenge();
    }
  }, [id, fetchChallenge]);

  const isAuthor = Boolean(
    user &&
      challenge &&
      (challenge.authorId === user.id ||
        challenge.authorId === user._id ||
        challenge.createdBy === user.firebase_uid)
  );

  const isAdmin = user?.role === "admin";
  const canManage = isAuthor || isAdmin;

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${challenge?.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      await challengeService.deleteChallenge(id);
      toast.success("Challenge successfully deleted");
      navigate("/challenges");
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete challenge";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!newStatus) return;

    try {
      setUpdatingStatus(true);
      const updated = await challengeService.updateChallengeStatus(id, {
        status: newStatus,
        reason: statusReason.trim() || undefined,
      });
      setChallenge(updated);
      setShowStatusModal(false);
      toast.success(`Challenge status updated to "${newStatus}"`);
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to update challenge status";
      toast.error(msg);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
          <div className="glass rounded-2xl border border-white/10 p-8 space-y-6 animate-pulse">
            <div className="flex gap-3">
              <div className="h-6 w-24 bg-white/10 rounded-full" />
              <div className="h-6 w-20 bg-white/10 rounded-full" />
            </div>
            <div className="h-10 w-3/4 bg-white/10 rounded-xl" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-white/5 rounded" />
              <div className="h-4 w-5/6 bg-white/5 rounded" />
              <div className="h-4 w-4/6 bg-white/5 rounded" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !challenge) {
    return (
      <DashboardLayout>
        <div className="glass rounded-2xl border border-rose-500/30 bg-rose-500/5 p-10 text-center space-y-4 max-w-lg mx-auto my-12">
          <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-white">Challenge Not Found</h2>
          <p className="text-sm text-slate-300">{error || "The requested societal challenge does not exist."}</p>
          <div className="pt-2">
            <Link
              to="/challenges"
              className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            >
              <ArrowLeft size={16} />
              <span>Back to Challenges</span>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto pb-12">
        {/* Navigation & Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/challenges"
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span>Back to Catalog</span>
          </Link>

          {canManage && (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={() => setShowStatusModal(true)}
                  className="btn-ghost inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-white/10 text-slate-200 hover:bg-white/5"
                >
                  <Settings size={14} />
                  <span>Update Status</span>
                </button>
              )}

              <Link
                to={`/challenges/${challenge.id}/edit`}
                className="btn-ghost inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-white/10 text-slate-200 hover:bg-white/5"
              >
                <Edit3 size={14} />
                <span>Edit Challenge</span>
              </Link>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-ghost inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border border-rose-500/20 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
              >
                <Trash2 size={14} />
                <span>{deleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Details Card */}
        <div className="glass rounded-2xl border border-white/10 p-6 md:p-8 space-y-6">
          {/* Top Badges Row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                {challenge.category}
              </span>
              <ChallengeStatusBadge status={challenge.status} size="md" />
              {challenge.difficulty && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    DIFFICULTY_STYLES[challenge.difficulty] ||
                    "bg-slate-500/20 text-slate-300 border-slate-500/30"
                  }`}
                >
                  {challenge.difficulty}
                </span>
              )}
            </div>

            {challenge.challengeCode && (
              <span className="font-mono text-xs text-slate-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                {challenge.challengeCode}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight">
            {challenge.title}
          </h1>

          {/* Metadata Row */}
          <div className="flex flex-wrap items-center gap-y-3 gap-x-6 text-xs md:text-sm text-slate-300 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary-400 shrink-0" />
              <span>{challenge.location}</span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400 shrink-0" />
              <span>Posted {formatDate(challenge.createdAt)}</span>
            </div>

            {challenge.updatedAt && (
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400 shrink-0" />
                <span>Updated {formatDate(challenge.updatedAt)}</span>
              </div>
            )}

            {challenge.deadline && (
              <div className="flex items-center gap-2 text-amber-300 font-medium">
                <Calendar size={16} className="text-amber-400 shrink-0" />
                <span>Deadline: {formatDate(challenge.deadline)}</span>
              </div>
            )}

            <div className="flex items-center gap-4 ml-auto text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Eye size={15} />
                <span>{challenge.viewsCount || 0} views</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText size={15} />
                <span>{challenge.proposalsCount || 0} proposals</span>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-3 pt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Problem Description
            </h3>
            <div className="prose prose-invert max-w-none text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-line bg-white/[0.02] p-5 rounded-xl border border-white/5">
              {challenge.description}
            </div>
          </div>

          {/* Expected Impact Banner */}
          {challenge.expectedImpact && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                <Sparkles size={18} />
                <span>Expected Societal Impact</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed">
                {challenge.expectedImpact}
              </p>
            </div>
          )}

          {/* Tags */}
          {challenge.tags && challenge.tags.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Tag size={13} />
                <span>Keywords & Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {challenge.tags.map((t, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg text-xs bg-white/5 border border-white/10 text-slate-300"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Section */}
          {challenge.attachments && challenge.attachments.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Supporting Attachments ({challenge.attachments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {challenge.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-surface-card hover:bg-white/5 hover:border-white/20 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      {getAttachmentIcon(att.name)}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate group-hover:text-primary-300 transition-colors">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatFileSize(att.sizeBytes)} • {att.fileType || "Document"}
                        </p>
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5 text-slate-400 group-hover:text-primary-400 group-hover:bg-primary-500/10 transition-colors shrink-0">
                      <Download size={15} />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Creator Attribution */}
          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-300 font-semibold">
                <User size={15} />
              </div>
              <div>
                <p className="text-white font-medium">
                  {challenge.authorName || "Verified Citizen / Community Member"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {challenge.authorRole ? `Role: ${challenge.authorRole}` : "Citizen Submission"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield size={14} className="text-emerald-400" />
              <span>Verified Societal Submission</span>
            </div>
          </div>
        </div>

        {/* Action Callouts: Module 4 Proposal & Module 3 Team Integration */}
        {challenge.isPublished && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Submit Proposal CTA (Module 4) */}
            <div className="glass rounded-2xl border border-primary-500/30 bg-gradient-to-br from-primary-900/30 via-surface-card to-surface-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary-500/15 text-primary-400 border border-primary-500/25">
                  <Lightbulb size={22} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Have a Technical Solution?</h3>
                  <p className="text-xs text-slate-300">Submit a structured proposal for evaluation</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Researchers, students, and industry solvers can draft an engineering solution,
                implementation roadmap, and resource requirements.
              </p>
              <div>
                <Link
                  to={`/proposals/new?challengeId=${challenge.id}`}
                  className="btn-primary inline-flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl font-semibold shadow-md shadow-primary-500/20 hover:shadow-primary-500/30 transition-all"
                >
                  <FileText size={15} />
                  <span>Submit Solution Proposal</span>
                </Link>
              </div>
            </div>

            {/* Form Collaborative Team CTA (Module 3) */}
            <div className="glass rounded-2xl border border-secondary-500/30 bg-gradient-to-br from-secondary-900/30 via-surface-card to-surface-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-secondary-500/15 text-secondary-400 border border-secondary-500/25">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Collaborate with Solvers</h3>
                  <p className="text-xs text-slate-300">Form a multi-disciplinary team</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Assemble developers, domain experts, and community advocates to co-create an
                end-to-end solution for this problem.
              </p>
              <div>
                <Link
                  to="/teams/create"
                  className="btn-ghost inline-flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl font-semibold border border-white/10 hover:bg-white/5 text-slate-200 transition-all"
                >
                  <Users size={15} />
                  <span>Form Team for Challenge</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Admin / Author Status Transition Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="glass rounded-2xl border border-white/10 bg-surface-card max-w-md w-full p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings size={18} className="text-primary-400" />
                  <span>Update Challenge Status</span>
                </h3>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleStatusUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Lifecycle Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="draft" className="bg-slate-900">Draft</option>
                    <option value="submitted" className="bg-slate-900">Submitted</option>
                    <option value="published" className="bg-slate-900">Published</option>
                    <option value="in_progress" className="bg-slate-900">In Progress</option>
                    <option value="resolved" className="bg-slate-900">Resolved</option>
                    <option value="closed" className="bg-slate-900">Closed</option>
                    <option value="archived" className="bg-slate-900">Archived</option>
                    <option value="rejected" className="bg-slate-900">Rejected</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Reason / Administrative Note (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Provide justification or feedback for this status update..."
                    className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white focus:outline-none focus:border-primary-500 placeholder-slate-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingStatus}
                    className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold"
                  >
                    {updatingStatus ? "Saving..." : "Save Status"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
