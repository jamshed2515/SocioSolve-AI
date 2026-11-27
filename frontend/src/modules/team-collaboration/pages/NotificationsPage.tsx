import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  CheckSquare,
  Clock,
  Filter,
  Mail,
  MessageSquare,
  CalendarClock,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import socketService from "../../../services/socketService";
import { useAuth } from "../../../context/AuthContext";
import type { NotificationResponse } from "../types";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "team_invitation":
      return <Mail size={18} className="text-violet-400" />;
    case "join_request":
    case "member_added":
      return <UserPlus size={18} className="text-emerald-400" />;
    case "join_accepted":
      return <Sparkles size={18} className="text-cyan-400" />;
    case "task_assigned":
    case "task_completed":
      return <CheckSquare size={18} className="text-amber-400" />;
    case "discussion_comment":
      return <MessageSquare size={18} className="text-blue-400" />;
    case "meeting_scheduled":
    case "meeting_updated":
      return <CalendarClock size={18} className="text-pink-400" />;
    case "milestone_completed":
      return <Trophy size={18} className="text-yellow-400" />;
    default:
      return <Bell size={18} className="text-primary-400" />;
  }
}

const TYPE_FILTERS = [
  { value: "all", label: "All Types" },
  { value: "team_invitation", label: "Invitations" },
  { value: "join_request", label: "Join Requests" },
  { value: "task_assigned", label: "Tasks" },
  { value: "discussion_comment", label: "Discussions" },
  { value: "meeting_scheduled", label: "Meetings" },
  { value: "milestone_completed", label: "Milestones" },
];

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 15;

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const params: {
        is_read?: boolean;
        type?: string;
        page: number;
        limit: number;
      } = {
        page,
        limit,
      };

      if (readFilter === "unread") params.is_read = false;
      if (readFilter === "read") params.is_read = true;
      if (typeFilter !== "all") params.type = typeFilter;

      const [res, countRes] = await Promise.all([
        teamApi.getNotifications(params),
        teamApi.getUnreadCount(),
      ]);

      setNotifications(res.items || []);
      setTotalPages(res.pages || 1);
      setTotalCount(res.total || 0);
      setUnreadCount(countRes.unread_count || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      toast.error("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [user, page, readFilter, typeFilter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // Real-time socket events
  useEffect(() => {
    if (!user) return;

    void socketService.connect();

    const unsubNew = socketService.on<NotificationResponse>("notification:new", (newNotif) => {
      setUnreadCount((c) => c + 1);
      // Prepend if matches current filter
      if (readFilter !== "read") {
        if (typeFilter === "all" || typeFilter === newNotif.type) {
          setNotifications((prev) => [newNotif, ...prev.slice(0, limit - 1)]);
          setTotalCount((c) => c + 1);
        }
      }
    });

    const unsubCount = socketService.on<{ unread_count: number }>(
      "notification:count_updated",
      (data) => {
        if (typeof data?.unread_count === "number") {
          setUnreadCount(data.unread_count);
        }
      }
    );

    const unsubRead = socketService.on<{ notification_id: string }>(
      "notification:read",
      (data) => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === data.notification_id ? { ...n, is_read: true } : n))
        );
      }
    );

    return () => {
      unsubNew();
      unsubCount();
      unsubRead();
    };
  }, [user, readFilter, typeFilter]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await teamApi.markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      toast.success("Notification marked as read");
    } catch {
      toast.error("Could not update notification");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await teamApi.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Could not mark all as read");
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await teamApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success("Notification deleted");
    } catch {
      toast.error("Could not delete notification");
    }
  };

  const handleClearRead = async () => {
    if (!window.confirm("Are you sure you want to delete all read notifications?")) {
      return;
    }
    try {
      const res = await teamApi.clearReadNotifications();
      toast.success(res.message || "Read notifications cleared");
      void loadNotifications();
    } catch {
      toast.error("Failed to clear read notifications");
    }
  };

  const handleNotificationClick = (notif: NotificationResponse) => {
    if (!notif.is_read) {
      void teamApi.markNotificationAsRead(notif.id).catch(() => {});
    }

    if (notif.type === "team_invitation") {
      navigate("/teams/invitations");
    } else if (notif.type === "join_request") {
      if (notif.team_id) {
        navigate(`/teams/${notif.team_id}?tab=roster`);
      } else {
        navigate("/teams/my-teams");
      }
    } else if (notif.type === "join_accepted" || notif.type === "join_rejected") {
      navigate("/teams/requests");
    } else if (notif.type === "task_assigned" || notif.type === "task_completed") {
      if (notif.team_id) {
        navigate(`/teams/${notif.team_id}?tab=tasks`);
      } else {
        navigate("/teams/tasks");
      }
    } else if (notif.type === "discussion_comment") {
      if (notif.team_id) {
        navigate(`/teams/${notif.team_id}?tab=discussions`);
      } else {
        navigate("/teams/discussions");
      }
    } else if (notif.type === "meeting_scheduled" || notif.type === "meeting_updated") {
      if (notif.team_id) {
        navigate(`/teams/${notif.team_id}?tab=meetings`);
      } else {
        navigate("/teams/meetings");
      }
    } else if (notif.type === "milestone_completed") {
      if (notif.team_id) {
        navigate(`/teams/${notif.team_id}?tab=milestones`);
      } else {
        navigate("/teams/meetings");
      }
    } else if (notif.team_id) {
      navigate(`/teams/${notif.team_id}`);
    }
  };

  // Filter client-side search query
  const filteredNotifications = notifications.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q) ||
      (n.team_name && n.team_name.toLowerCase().includes(q)) ||
      (n.sender_name && n.sender_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-dark-800/80 border border-white/10 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white">Collaboration Notifications</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-white/50 mt-1">
            Real-time collaboration alerts, team invitations, task assignments, and discussion mentions.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary-500/15 text-primary-300 border border-primary-500/30 hover:bg-primary-500/25 transition"
            >
              <CheckCheck size={14} />
              <span>Mark All Read</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearRead}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-white/70 border border-white/10 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 transition"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear Read</span>
          </button>

          <button
            type="button"
            onClick={() => void loadNotifications()}
            title="Refresh notifications"
            className="p-2 rounded-xl bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Read Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 max-w-fit">
          <button
            type="button"
            onClick={() => {
              setReadFilter("all");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              readFilter === "all"
                ? "bg-primary-500 text-white shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => {
              setReadFilter("unread");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              readFilter === "unread"
                ? "bg-primary-500 text-white shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setReadFilter("read");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              readFilter === "read"
                ? "bg-primary-500 text-white shadow-sm"
                : "text-white/60 hover:text-white"
            }`}
          >
            Read
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Type Filter Dropdown */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by notification type"
              className="appearance-none pl-8 pr-8 py-2 rounded-xl text-xs bg-dark-800 text-white/80 border border-white/10 hover:border-white/20 focus:outline-none focus:border-primary-500"
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value} className="bg-dark-900 text-white">
                  {f.label}
                </option>
              ))}
            </select>
            <Filter size={13} className="absolute left-2.5 top-2.5 text-white/40 pointer-events-none" />
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-dark-800 text-white border border-white/10 hover:border-white/20 focus:outline-none focus:border-primary-500 placeholder-white/30"
            />
            <Search size={13} className="absolute left-2.5 top-2.5 text-white/40 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-dark-800/60 rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5">
        {loading && notifications.length === 0 ? (
          <div className="p-16 text-center">
            <RefreshCw size={24} className="animate-spin text-primary-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-white/60">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
              <Bell size={24} className="text-white/30" />
            </div>
            <h3 className="text-sm font-semibold text-white">No notifications found</h3>
            <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No notifications matching "${searchQuery}".`
                : readFilter === "unread"
                ? "You have caught up with all your notifications!"
                : "No notifications recorded yet for your account."}
            </p>
            <div className="mt-4">
              <Link
                to="/teams/explore"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary-500/20 text-primary-300 border border-primary-500/30 hover:bg-primary-500/30 transition"
              >
                <span>Explore Teams</span>
                <ExternalLink size={12} />
              </Link>
            </div>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-4 flex items-start gap-4 cursor-pointer transition group ${
                notif.is_read
                  ? "hover:bg-white/[0.02] text-white/70"
                  : "bg-primary-500/[0.06] hover:bg-primary-500/[0.12] text-white"
              }`}
            >
              {/* Type Icon Badge */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  notif.is_read
                    ? "bg-white/5 border-white/5"
                    : "bg-primary-500/20 border-primary-500/30 shadow-sm shadow-primary-500/10"
                }`}
              >
                {getNotificationIcon(notif.type)}
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4
                    className={`text-sm ${
                      notif.is_read ? "font-medium text-white/85" : "font-semibold text-white"
                    }`}
                  >
                    {notif.title}
                  </h4>
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary-400 ring-2 ring-primary-500/30 shrink-0" />
                  )}
                  {notif.team_name && (
                    <span className="text-[10px] font-medium text-primary-300 bg-primary-500/15 border border-primary-500/25 px-2 py-0.5 rounded-full">
                      {notif.team_name}
                    </span>
                  )}
                </div>

                <p className="text-xs text-white/60 mt-1 leading-relaxed">{notif.message}</p>

                <div className="flex items-center gap-4 mt-2 text-[11px] text-white/40">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{formatRelativeTime(notif.created_at)}</span>
                  </span>
                  {notif.sender_name && (
                    <span>By: <span className="text-white/60">{notif.sender_name}</span></span>
                  )}
                  {notif.reference_type && (
                    <span className="capitalize text-white/35">· {notif.reference_type}</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                {!notif.is_read && (
                  <button
                    type="button"
                    title="Mark as read"
                    onClick={(e) => handleMarkAsRead(notif.id, e)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-primary-300 hover:bg-white/5 transition"
                  >
                    <Check size={15} />
                  </button>
                )}
                <button
                  type="button"
                  title="Delete notification"
                  onClick={(e) => handleDelete(notif.id, e)}
                  className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-white/50 pt-2">
          <span>
            Showing page {page} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium text-white">{page}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
