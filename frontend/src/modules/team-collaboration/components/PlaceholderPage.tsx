import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Layers } from "lucide-react";
import { EmptyState } from "./StateBanner";

interface PlaceholderPageProps {
  title: string;
  phaseLabel: string;
  description: string;
  icon: ReactNode;
  plannedFeatures: string[];
}

export default function PlaceholderPage({
  title,
  phaseLabel,
  description,
  icon,
  plannedFeatures,
}: PlaceholderPageProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="glass p-6 bg-gradient-to-r from-primary-500/10 via-dark-700/40 to-accent-400/10 border-primary-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-300 shrink-0">
              {icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">{title}</h2>
                <span className="badge bg-accent-400/15 text-accent-400 border border-accent-400/25">
                  {phaseLabel}
                </span>
              </div>
              <p className="text-sm text-white/55 mt-1 max-w-2xl">
                {description}
              </p>
            </div>
          </div>

          <Link to="/teams" className="btn-ghost text-xs px-4 py-2.5 shrink-0">
            <ArrowLeft size={15} />
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Empty State Placeholder */}
      <EmptyState
        icon={<Layers className="w-6 h-6 text-primary-400" />}
        title={`${title} – Phase 1 Foundation Placeholder`}
        description="This workspace section is wired into the Module 3 router and layout. Live data, forms, and FastAPI endpoints for this view will be built in its dedicated implementation phase."
      />

      {/* Planned Scope Card */}
      <div className="glass p-6">
        <h3 className="text-sm font-semibold text-white mb-4">
          Planned Capabilities for {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {plannedFeatures.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5"
            >
              <CheckCircle2
                size={16}
                className="text-accent-400 shrink-0 mt-0.5"
              />
              <span className="text-sm text-white/75">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

