import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  LayoutDashboard,
  User,
  LogOut,
  Menu,
  X,
  Zap,
  Bell,
  FileText,
  FolderKanban,
  PlusCircle,
  ClipboardCheck,
  Users,
} from "lucide-react";
import proposalService from "../../services/proposalService";
import { auth } from "../../config/firebase";

const NAV_ITEMS = {
  citizen: [
    { to: "/dashboard/citizen", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/proposals", icon: FileText, label: "Proposals Hub" },
    { to: "/proposals/my", icon: FolderKanban, label: "My Proposals" },
    { to: "/proposals/new", icon: PlusCircle, label: "Submit Proposal" },
  ],
  student: [
    { to: "/dashboard/student", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/proposals", icon: FileText, label: "Proposals Hub" },
    { to: "/proposals/my", icon: FolderKanban, label: "My Proposals" },
    { to: "/proposals/new", icon: PlusCircle, label: "Submit Proposal" },
  ],
  university: [
    { to: "/dashboard/university", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/proposals", icon: FileText, label: "Proposals Hub" },
    { to: "/proposals/my", icon: FolderKanban, label: "My Proposals" },
    { to: "/proposals/new", icon: PlusCircle, label: "Submit Proposal" },
    { to: "/proposals/review-queue", icon: ClipboardCheck, label: "Review Queue" },
  ],
  industry: [
    { to: "/dashboard/industry", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/proposals", icon: FileText, label: "Proposals Hub" },
    { to: "/proposals/review-queue", icon: ClipboardCheck, label: "Review Queue" },
  ],
  admin: [
    { to: "/dashboard/admin", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/proposals", icon: FileText, label: "Proposals Hub" },
    { to: "/proposals/review-queue", icon: ClipboardCheck, label: "Review Queue" },
    { to: "/proposals/my", icon: FolderKanban, label: "My Proposals" },
  ],
};

const ROLE_COLORS = {
  citizen: "from-blue-500 to-cyan-500",
  student: "from-violet-500 to-purple-500",
  university: "from-amber-500 to-orange-500",
  industry: "from-emerald-500 to-teal-500",
  admin: "from-rose-500 to-pink-500",
};

const ROLE_BADGE = {
  citizen: "bg-blue-500/20 text-blue-300",
  student: "bg-violet-500/20 text-violet-300",
  university: "bg-amber-500/20 text-amber-300",
  industry: "bg-emerald-500/20 text-emerald-300",
  admin: "bg-rose-500/20 text-rose-300",
};

export default function DashboardLayout({ children, title }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = NAV_ITEMS[user?.role] || NAV_ITEMS.student;
  const gradient = ROLE_COLORS[user?.role] || "from-primary-500 to-accent-400";
  const badgeCls = ROLE_BADGE[user?.role] || "bg-primary-500/20 text-primary-300";

  useEffect(() => {
    let active = true;
    proposalService
      .getNotifications()
      .then((res) => {
        if (active) setNotifications(res.notifications || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

  // Real-time WebSocket stream for Module 4 proposal notifications
  useEffect(() => {
    const state = { ws: null, cancelled: false };

    const connectWs = async () => {
      try {
        const fbUser = auth.currentUser;
        if (!fbUser || state.cancelled) return;
        const token = await fbUser.getIdToken();
        if (!token || state.cancelled) return;
        const wsUrl = proposalService.getNotificationsWebSocketUrl(token);
        const socket = new WebSocket(wsUrl);
        state.ws = socket;
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.event === "notification" && payload.data) {
              setNotifications((prev) => {
                if (prev.some((n) => n.id === payload.data.id)) return prev;
                return [payload.data, ...prev].slice(0, 30);
              });
            }
          } catch {
            // ignore non-JSON frames
          }
        };
      } catch {
        // WebSocket is progressive enhancement; HTTP polling still works
      }
    };

    connectWs();
    return () => {
      state.cancelled = true;
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.close();
      }
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    try {
      await proposalService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      // ignore
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await proposalService.markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((item) => (item.id === notif.id ? { ...item, isRead: true } : item))
        );
      }
    } catch {
      // ignore
    }
    setNotifOpen(false);
    if (notif.referenceId) {
      navigate(`/proposals/${notif.referenceId}`);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-white/5
        transform transition-transform duration-300 flex flex-col
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:flex`}
      >
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
            <div
              className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white text-sm`}
            >
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
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                ${
                  location.pathname === to
                    ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          <Link
            to="/teams"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${
                location.pathname.startsWith("/teams")
                  ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
          >
            <Users size={18} />
            Team Collaboration
          </Link>
          <Link
            to="/profile"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
              ${
                location.pathname === "/profile"
                  ? "bg-primary-500/20 text-primary-400 border border-primary-500/30"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
          >
            <User size={18} />
            My Profile
          </Link>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400
              hover:bg-red-500/10 w-full transition-all"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-dark-800/80 backdrop-blur border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden text-white/50 hover:text-white"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
          </div>
          <div className="flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
            >
              <Bell size={18} className="text-white/60" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-primary-500 rounded-full ring-2 ring-dark-800" />
              )}
            </button>

            {/* Notifications Dropdown */}
            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 glass bg-dark-800/95 border border-white/15 shadow-2xl p-3 z-50 space-y-2">
                <div className="flex items-center justify-between px-2 py-1 border-b border-white/10">
                  <span className="text-xs font-bold text-white">Notifications</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-primary-400">{unreadCount} unread</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-white/60 hover:text-white underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-white/40 text-center py-4">
                    No notifications yet.
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1.5">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs transition ${
                          n.isRead
                            ? "bg-white/5 text-white/60 hover:bg-white/10"
                            : "bg-primary-500/15 border border-primary-500/30 text-white"
                        }`}
                      >
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-[11px] text-white/70 line-clamp-2 mt-0.5">
                          {n.message}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Link
              to="/profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition"
            >
              <div
                className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-xs font-bold text-white`}
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm text-white/70 hidden sm:block">{user?.name}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
