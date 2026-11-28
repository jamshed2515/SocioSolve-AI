import React from "react";
import {
  FileEdit,
  Clock,
  CheckCircle2,
  Activity,
  Award,
  Archive,
  XCircle,
  HelpCircle,
} from "lucide-react";

export const CHALLENGE_STATUS_CONFIG = {
  draft: {
    label: "Draft",
    badgeClass: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
    dotClass: "bg-slate-400",
    Icon: FileEdit,
  },
  submitted: {
    label: "Submitted",
    badgeClass: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    dotClass: "bg-blue-400",
    Icon: Clock,
  },
  published: {
    label: "Published",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    dotClass: "bg-emerald-400",
    Icon: CheckCircle2,
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
    dotClass: "bg-violet-400",
    Icon: Activity,
  },
  resolved: {
    label: "Resolved",
    badgeClass: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    dotClass: "bg-cyan-400",
    Icon: Award,
  },
  closed: {
    label: "Closed",
    badgeClass: "bg-zinc-500/20 text-zinc-300 border border-zinc-500/30",
    dotClass: "bg-zinc-400",
    Icon: Archive,
  },
  archived: {
    label: "Archived",
    badgeClass: "bg-neutral-500/20 text-neutral-300 border border-neutral-500/30",
    dotClass: "bg-neutral-400",
    Icon: Archive,
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    dotClass: "bg-rose-400",
    Icon: XCircle,
  },
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs gap-1.5",
  md: "px-2.5 py-1 text-xs gap-2",
  lg: "px-3 py-1.5 text-sm gap-2.5",
};

const ICON_SIZES = {
  sm: 12,
  md: 14,
  lg: 16,
};

export default function ChallengeStatusBadge({
  status,
  size = "md",
  showDot = false,
  showIcon = true,
  className = "",
}) {
  const normKey = (status || "").toLowerCase().trim();
  const config = CHALLENGE_STATUS_CONFIG[normKey] || {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown",
    badgeClass: "bg-white/10 text-white/80 border border-white/20",
    dotClass: "bg-white/60",
    Icon: HelpCircle,
  };

  const { label, badgeClass, dotClass, Icon } = config;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconSize = ICON_SIZES[size] || 14;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${badgeClass} ${sizeClass} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass} animate-pulse`}
          aria-hidden="true"
        />
      )}
      {showIcon && Icon && <Icon size={iconSize} className="shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
