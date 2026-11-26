import React from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Calendar,
  Eye,
  FileText,
  ArrowRight,
  Edit3,
  Trash2,
  Sparkles,
  User,
} from "lucide-react";
import ChallengeStatusBadge from "./ChallengeStatusBadge";

const DIFFICULTY_STYLES = {
  Easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Hard: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const CATEGORY_COLORS = {
  "Healthcare": "from-red-500/20 to-pink-500/20 text-red-300 border-red-500/30",
  "Education": "from-blue-500/20 to-indigo-500/20 text-blue-300 border-blue-500/30",
  "Agriculture": "from-emerald-500/20 to-green-500/20 text-emerald-300 border-emerald-500/30",
  "Environment & Water": "from-cyan-500/20 to-teal-500/20 text-cyan-300 border-cyan-500/30",
  "Waste Management": "from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30",
  "Smart Cities & Mobility": "from-purple-500/20 to-violet-500/20 text-purple-300 border-purple-500/30",
  "Renewable Energy": "from-lime-500/20 to-emerald-500/20 text-lime-300 border-lime-500/30",
  "Other": "from-slate-500/20 to-zinc-500/20 text-slate-300 border-slate-500/30",
};

export default function ChallengeCard({
  challenge,
  showStatus = true,
  isAuthor = false,
  isAdmin = false,
  onEdit,
  onDelete,
}) {
  if (!challenge) return null;

  const {
    id,
    challengeCode,
    title,
    description,
    category,
    location,
    difficulty,
    status,
    expectedImpact,
    createdAt,
    proposalsCount = 0,
    viewsCount = 0,
    authorName,
    createdBy,
  } = challenge;

  // Format creation date
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Recently added";

  const diffClass = DIFFICULTY_STYLES[difficulty] || "bg-white/10 text-white/70 border-white/20";
  const catClass = CATEGORY_COLORS[category] || CATEGORY_COLORS["Other"];
  const creatorDisplay = authorName || createdBy || "Citizen Reporter";

  return (
    <article
      className="glass p-6 flex flex-col justify-between hover:border-primary-500/40
                 transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden"
    >
      {/* Top row: Category tag, difficulty, status badge */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border bg-gradient-to-r ${catClass}`}
            >
              {category}
            </span>
            {difficulty && (
              <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${diffClass}`}>
                {difficulty}
              </span>
            )}
          </div>

          {showStatus && status && (
            <ChallengeStatusBadge status={status} size="sm" showDot />
          )}
        </div>

        {/* Challenge Code & Title */}
        {challengeCode && (
          <p className="text-[11px] font-mono text-primary-400 mb-1 tracking-wider uppercase">
            {challengeCode}
          </p>
        )}
        <h3 className="text-lg font-bold text-white group-hover:text-primary-300 transition-colors line-clamp-2 mb-2">
          <Link to={`/challenges/${id}`} className="focus:outline-none focus:underline">
            {title}
          </Link>
        </h3>

        {/* Short description excerpt */}
        <p className="text-white/60 text-sm line-clamp-3 mb-4 leading-relaxed">
          {description}
        </p>

        {/* Impact statement preview (if provided) */}
        {expectedImpact && (
          <div className="mb-4 p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2 text-xs text-white/80">
            <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              <strong className="text-white">Impact:</strong> {expectedImpact}
            </span>
          </div>
        )}
      </div>

      {/* Bottom section: metadata & footer CTAs */}
      <div className="pt-4 border-t border-white/10 space-y-3">
        {/* Meta badges: Location, author, date */}
        <div className="flex flex-wrap items-center justify-between text-xs text-white/50 gap-2">
          <div className="flex items-center gap-1.5 truncate max-w-[160px]" title={location}>
            <MapPin size={13} className="text-cyan-400 shrink-0" />
            <span className="truncate">{location || "Location not specified"}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 max-w-[120px] truncate" title={creatorDisplay}>
              <User size={13} className="shrink-0 text-white/40" />
              <span className="truncate">{creatorDisplay}</span>
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar size={13} className="shrink-0" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Stats and Action button */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span className="inline-flex items-center gap-1" title="Views">
              <Eye size={13} className="text-white/40" />
              {viewsCount}
            </span>
            <span className="inline-flex items-center gap-1" title="Submitted proposals">
              <FileText size={13} className="text-accent-400" />
              {proposalsCount} {proposalsCount === 1 ? "proposal" : "proposals"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {(isAuthor || isAdmin) && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(challenge)}
                className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition"
                title="Edit Challenge"
                aria-label="Edit Challenge"
              >
                <Edit3 size={15} />
              </button>
            )}

            {(isAuthor || isAdmin) && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(challenge)}
                className="p-1.5 text-rose-400/70 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition"
                title="Delete Challenge"
                aria-label="Delete Challenge"
              >
                <Trash2 size={15} />
              </button>
            )}

            <Link
              to={`/challenges/${id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400
                         hover:text-primary-300 transition-colors ml-1"
            >
              <span>Details</span>
              <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
