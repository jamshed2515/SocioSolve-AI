import {
  CheckCircle2,
  ListChecks,
  Mail,
  UserCheck,
  Users,
} from "lucide-react";
import type { DashboardStatItem } from "../types";

const ICON_MAP = {
  users: Users,
  "user-check": UserCheck,
  mail: Mail,
  "list-checks": ListChecks,
  "check-circle": CheckCircle2,
} as const;

interface StatCardProps {
  stat: DashboardStatItem;
}

export default function StatCard({ stat }: StatCardProps) {
  const Icon = ICON_MAP[stat.iconName];

  return (
    <div className="stat-card group">
      <div className="flex items-center justify-between">
        <div
          className={`w-10 h-10 rounded-xl ${stat.accentBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}
        >
          <Icon className={stat.accentColor} size={20} />
        </div>
        <span className="text-[11px] font-medium text-white/40 bg-white/5 px-2.5 py-1 rounded-full">
          Mock
        </span>
      </div>

      <div className="mt-2">
        <p className="text-3xl font-bold tracking-tight text-white">
          {stat.value}
        </p>
        <p className="text-sm font-medium text-white/70 mt-0.5">{stat.label}</p>
      </div>

      <p className="text-xs text-white/45 pt-2 border-t border-white/5">
        {stat.changeText}
      </p>
    </div>
  );
}

