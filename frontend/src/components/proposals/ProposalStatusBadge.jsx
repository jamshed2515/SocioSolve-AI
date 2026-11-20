import {
  FileEdit,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";

export const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    badgeClass: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
    dotClass: "bg-slate-400",
    barClass: "bg-slate-400",
    Icon: FileEdit,
  },
  submitted: {
    label: "Submitted",
    badgeClass: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    dotClass: "bg-blue-400",
    barClass: "bg-blue-500",
    Icon: Send,
  },
  under_review: {
    label: "Under Review",
    badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    dotClass: "bg-amber-400",
    barClass: "bg-amber-500",
    Icon: Clock,
  },
  accepted: {
    label: "Accepted",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    dotClass: "bg-emerald-400",
    barClass: "bg-emerald-500",
    Icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    dotClass: "bg-rose-400",
    barClass: "bg-rose-500",
    Icon: XCircle,
  },
  withdrawn: {
    label: "Withdrawn",
    badgeClass: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    dotClass: "bg-purple-400",
    barClass: "bg-purple-500",
    Icon: RotateCcw,
  },
};

export default function ProposalStatusBadge({ status, size = "sm" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = cfg.Icon;
  const sizeCls =
    size === "lg"
      ? "px-3.5 py-1.5 text-xs gap-2"
      : "px-2.5 py-1 text-[11px] gap-1.5";

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${cfg.badgeClass} ${sizeCls}`}>
      <Icon size={size === "lg" ? 14 : 12} />
      {cfg.label}
    </span>
  );
}

export function ProposalWorkflowStepper({ status }) {
  const steps = [
    { key: "draft", label: "Draft" },
    { key: "submitted", label: "Submitted" },
    { key: "under_review", label: "Under Review" },
    {
      key: status === "rejected" ? "rejected" : "accepted",
      label: status === "rejected" ? "Rejected" : status === "accepted" ? "Accepted" : "Decision",
    },
  ];

  const orderMap = {
    draft: 0,
    submitted: 1,
    under_review: 2,
    accepted: 3,
    rejected: 3,
    withdrawn: 1,
  };
  const currentIdx = orderMap[status] ?? 0;

  return (
    <div className="w-full py-2">
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentIdx || (idx === 3 && (status === "accepted" || status === "rejected"));
          const isCurrent = idx === currentIdx;
          const isRejectedFinal = idx === 3 && status === "rejected";

          let barColor = "bg-white/10";
          let textColor = "text-white/40";
          if (isRejectedFinal) {
            barColor = "bg-rose-500";
            textColor = "text-rose-300 font-semibold";
          } else if (isCompleted || isCurrent) {
            barColor = idx === 3 && status === "accepted" ? "bg-emerald-500" : "bg-primary-500";
            textColor = idx === 3 && status === "accepted" ? "text-emerald-300 font-semibold" : "text-white font-medium";
          }

          return (
            <div key={step.key} className="flex flex-col gap-1.5">
              <div className={`h-1.5 rounded-full transition-all ${barColor}`} />
              <span className={`text-[11px] truncate ${textColor}`}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
