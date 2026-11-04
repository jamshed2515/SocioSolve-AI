import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard, User, LogOut, Menu, X, Zap,
  Bell, ChevronDown,
} from "lucide-react";

const NAV_ITEMS = {
  citizen:    [{ to: "/dashboard/citizen",    icon: LayoutDashboard, label: "Dashboard" }],
  student:    [{ to: "/dashboard/student",    icon: LayoutDashboard, label: "Dashboard" }],
  university: [{ to: "/dashboard/university", icon: LayoutDashboard, label: "Dashboard" }],
  industry:   [{ to: "/dashboard/industry",   icon: LayoutDashboard, label: "Dashboard" }],
  admin:      [{ to: "/dashboard/admin",      icon: LayoutDashboard, label: "Dashboard" }],
};

const ROLE_COLORS = {
  citizen:    "from-blue-500 to-cyan-500",
  student:    "from-violet-500 to-purple-500",
  university: "from-amber-500 to-orange-500",
  industry:   "from-emerald-500 to-teal-500",
  admin:      "from-rose-500 to-pink-500",
};

const ROLE_BADGE = {
  citizen:    "bg-blue-500/20 text-blue-300",
  student:    "bg-violet-500/20 text-violet-300",
  university: "bg-amber-500/20 text-amber-300",
  industry:   "bg-emerald-500/20 text-emerald-300",
  admin:      "bg-rose-500/20 text-rose-300",
};

export default function DashboardLayout({ children, title }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = NAV_ITEMS[user?.role] || [];
  const gradient = ROLE_COLORS[user?.role] || "from-primary-500 to-accent-400";
  const badgeCls = ROLE_BADGE[user?.role] || "bg-primary-500/20 text-primary-300";

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-white/5
        transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}>

        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
              <Zap size={18} className="text-primary-400" />
            </div>
            <span className="font-bold text-white text-lg">SocioSolve</span>
          </div>
        </div>

        {/* User pill */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
            <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white text-sm`}>
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <span className={`badge text-[10px] mt-0.5 ${badgeCls}`}>
                {user?.role?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                ${location.pathname === to
                  ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                  : "text-white/50 hover:text-white hover:bg-white/5"}`}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <Link to="/profile"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${location.pathname === "/profile"
                ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                : "text-white/50 hover:text-white hover:bg-white/5"}`}>
            <User size={18} />
            My Profile
          </Link>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400
              hover:bg-red-500/10 w-full transition-all">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-dark-800/80 backdrop-blur border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition">
              <Bell size={18} className="text-white/60" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-500 rounded-full" />
            </button>
            <Link to="/profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition">
              <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white`}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-white/70 hidden sm:block">{user?.name}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
