import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  Clock,
  Compass,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  RefreshCw,
  User,
  Users,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useBackendHealth } from "../hooks/useBackendHealth";
import type { AuthUser, UserRole } from "../types";

interface TeamNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: string;
}

const TEAM_NAV_ITEMS: TeamNavItem[] = [
  { to: "/teams", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/teams/my-teams", label: "My Teams", icon: Users },
  { to: "/teams/explore", label: "Explore Teams", icon: Compass },
  { to: "/teams/requests", label: "My Applications", icon: Clock },
  { to: "/teams/invitations", label: "Invitations", icon: Mail, badge: "2" },
  { to: "/teams/discussions", label: "Discussions", icon: MessageSquare },
  { to: "/teams/tasks", label: "My Tasks", icon: CheckSquare },
  { to: "/teams/meetings", label: "Meetings & Milestones", icon: CalendarClock },
];

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  "/teams": {
    title: "Team Collaboration Dashboard",
    subtitle: "Module 3 – Societal Innovation Collaboration Portal for Jharkhand",
  },
  "/teams/my-teams": {
    title: "My Teams",
    subtitle: "Manage teams you lead or collaborate in across Jharkhand challenges",
  },
  "/teams/create": {
    title: "Create Team",
    subtitle: "Form a new societal innovation team for a Jharkhand challenge",
  },
  "/teams/explore": {
    title: "Explore Teams",
    subtitle: "Discover active innovation teams seeking collaborators and mentors",
  },
  "/teams/requests": {
    title: "My Applications",
    subtitle: "Track your join requests to innovation teams across Jharkhand",
  },
  "/teams/invitations": {
    title: "Invitations",
    subtitle: "Review pending team invitations and join request responses",
  },
  "/teams/discussions": {
    title: "Discussions",
    subtitle: "Team channels and real-time collaboration threads",
  },
  "/teams/tasks": {
    title: "My Tasks",
    subtitle: "Track assigned deliverables across your active project teams",
  },
  "/teams/meetings": {
    title: "Meetings & Milestones",
    subtitle: "Coordinate syncs, mentor check-ins, and challenge milestones",
  },
};

const ROLE_COLORS: Record<UserRole, string> = {
  citizen: "from-blue-500 to-cyan-500",
  student: "from-violet-500 to-purple-500",
  university: "from-amber-500 to-orange-500",
  industry: "from-emerald-500 to-teal-500",
  admin: "from-rose-500 to-pink-500",
};

const ROLE_BADGE: Record<UserRole, string> = {
  citizen: "bg-blue-500/20 text-blue-300",
  student: "bg-violet-500/20 text-violet-300",
  university: "bg-amber-500/20 text-amber-300",
  industry: "bg-emerald-500/20 text-emerald-300",
  admin: "bg-rose-500/20 text-rose-300",
};

export interface TeamOutletContext {
  backendHealth: ReturnType<typeof useBackendHealth>;
}

export default function TeamCollaborationLayout() {
  const { user, logout, ROLE_DASHBOARD } = useAuth() as {
    user: AuthUser | null;
    logout: () => Promise<void>;
    ROLE_DASHBOARD: Record<string, string>;
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const backendHealth = useBackendHealth();

  const headerMeta =
    ROUTE_TITLES[location.pathname] ??
    (location.pathname.startsWith("/teams/")
      ? {
          title: "Team Details & Workspace",
          subtitle: "Manage roster, challenge alignment, and collaboration settings",
        }
      : {
          title: "Team Collaboration",
          subtitle: "Module 3 – Team Formation & Collaboration",
        });

  const userRole = user?.role;
  const avatarGradient = userRole
    ? ROLE_COLORS[userRole]
    : "from-primary-500 to-accent-400";
  const roleBadgeClass = userRole
    ? ROLE_BADGE[userRole]
    : "bg-primary-500/20 text-primary-300";

  const portalDashboardPath =
    userRole && ROLE_DASHBOARD?.[userRole] ? ROLE_DASHBOARD[userRole] : "/login";

  return (
    <div className="min-h-screen bg-dark-900 text-white flex">
      {/* ── Responsive Sidebar ─────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-dark-800 border-r border-white/10
          transform transition-transform duration-300 flex flex-col
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <Link to="/teams" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center group-hover:bg-primary-500/30 transition">
              <Zap size={19} className="text-primary-400" />
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight">
                SocioSolve-AI
              </p>
              <p className="text-[11px] text-accent-400 font-medium">
                Module 3 · Team Hub
              </p>
            </div>
          </Link>
          <button
            type="button"
            aria-label="Close navigation menu"
            className="lg:hidden text-white/50 hover:text-white p-1"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* User Profile Summary Card */}
        <div className="p-4 border-b border-white/10">
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div
                className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center font-bold text-white text-sm shrink-0`}
              >
                {user.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">
                  {user.name || "Authenticated User"}
                </p>
                <span className={`badge text-[10px] mt-1 ${roleBadgeClass}`}>
                  {user.role?.toUpperCase() || "MEMBER"}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
              <p className="text-xs font-semibold text-white">
                Guest Preview Mode
              </p>
              <p className="text-[11px] text-white/55 mt-0.5 leading-relaxed">
                Sign in via Module 1 Auth to load your live profile and JWT
                session.
              </p>
              <Link
                to="/login"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-300 hover:text-primary-200 transition"
              >
                <LogIn size={13} /> Sign in with Module 1
              </Link>
            </div>
          )}
        </div>

        {/* Primary Module 3 Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto" aria-label="Module 3 Navigation">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
            Collaboration Workspace
          </p>
          {TEAM_NAV_ITEMS.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-sm shadow-primary-500/10"
                    : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                }`
              }
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon size={18} className="shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              {badge && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  {badge}
                </span>
              )}
            </NavLink>
          ))}

          <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
              Portal Navigation
            </p>
            <Link
              to={portalDashboardPath}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              <ArrowLeft size={18} />
              <span>{user ? "Back to Role Dashboard" : "Portal Sign In"}</span>
            </Link>
            {user && (
              <Link
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <User size={18} />
                <span>My Profile</span>
              </Link>
            )}
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-[11px] text-white/50">
            <span>Jharkhand Innovation Portal</span>
            <span className="text-accent-400 font-semibold">Phase 1</span>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 w-full transition-all"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Main Content Shell ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-dark-800/85 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold text-white truncate">
                {headerMeta.title}
              </h1>
              <p className="text-xs text-white/45 truncate hidden sm:block">
                {headerMeta.subtitle}
              </p>
            </div>
          </div>

          {/* Right Header Actions: Backend Health Pill + Profile Section */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => void backendHealth.refresh()}
              title={
                backendHealth.apiReachable
                  ? `Backend healthy · Last checked ${backendHealth.lastCheckedAt ?? ""}`
                  : "FastAPI backend unreachable – click to recheck"
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                backendHealth.loading
                  ? "bg-white/5 border-white/10 text-white/60"
                  : backendHealth.apiReachable
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/15"
                    : "bg-red-500/10 border-red-500/25 text-red-300 hover:bg-red-500/15"
              }`}
            >
              {backendHealth.loading ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : backendHealth.apiReachable ? (
                <Wifi size={13} />
              ) : (
                <WifiOff size={13} />
              )}
              <span className="hidden md:inline">
                {backendHealth.loading
                  ? "Checking API..."
                  : backendHealth.apiReachable
                    ? "API Connected"
                    : "API Offline"}
              </span>
            </button>

            {user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition"
              >
                <div
                  className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-xs font-bold text-white`}
                >
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-white leading-tight">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-white/45 capitalize leading-tight">
                    {user.role}
                  </p>
                </div>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-500/15 hover:bg-primary-500/25 border border-primary-500/30 text-xs font-semibold text-primary-200 transition"
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </header>

        {/* Active Module 3 Page */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet context={{ backendHealth } satisfies TeamOutletContext} />
          </div>
        </main>
      </div>
    </div>
  );
}

