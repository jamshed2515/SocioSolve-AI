import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  Check,
  CheckCheck,
  CheckSquare,
  Clock,
  ExternalLink,
  Mail,
  MessageSquare,
  CalendarClock,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
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
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "team_invitation":
      return <Mail size={15} className="text-violet-400" />;
    case "join_request":
    case "member_added":
      return <UserPlus size={15} className="text-emerald-400" />;
    case "join_accepted":
      return <Sparkles size={15} className="text-cyan-400" />;
    case "task_assigned":
    case "task_completed":
      return <CheckSquare size={15} className="text-amber-400" />;
    case "discussion_comment":
      return <MessageSquare size={15} className="text-blue-400" />;
    case "meeting_scheduled":
    case "meeting_updated":
      return <CalendarClock size={15} className="text-pink-400" />;
    case "milestone_completed":
      return <Trophy size={15} className="text-yellow-400" />;
    default:
      return <Bell size={15} className="text-primary-400" />;
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial notifications and unread count
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [listRes, countRes] = await Promise.all([
        teamApi.getNotifications({ limit: 8 }),
        teamApi.getUnreadCount(),
      ]);
      setNotifications(listRes.items || []);
      setUnreadCount(countRes.unread_count || 0);
    } catch (err) {
      console.warn("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Connect socket and listen for real-time notifications
  useEffect(() => {
    if (!user) return;

    void socketService.connect();

    const unsubNew = socketService.on<NotificationResponse>("notification:new", (newNotif) => {
      setNotifications((prev) => {
        // Avoid duplicate in UI
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev.slice(0, 7)];
      });
      setUnreadCount((prev) => prev + 1);

      // Toast alert
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? "animate-enter" : "animate-leave"
            } max-w-sm w-full bg-dark-800 border border-primary-500/40 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3 pointer-events-auto cursor-pointer hover:border-primary-400 transition`}
            onClick={() => {
              toast.dismiss(t.id);
              handleNotificationClick(newNotif);
            }}
          >
            <div className="w-8 h-8 rounded-xl bg-primary-500/20 flex items-center justify-center shrink-0 mt-0.5">
              {getNotificationIcon(newNotif.type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{newNotif.title}</p>
              <p className="text-[11px] text-white/60 line-clamp-2 mt-0.5">{newNotif.message}</p>
            </div>
          </div>
        ),
        { duration: 4000 }
      );
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
  }, [user]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await teamApi.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleNotificationClick = async (notif: NotificationResponse) => {
    setIsOpen(false);
    // Mark as read if not already read
    if (!notif.is_read) {
      try {
        await teamApi.markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // continue navigation anyway
      }
    }

    // Smart routing based on notification type and reference
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
    } else {
      navigate("/teams/notifications");
    }
  };

  const badgeText = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        aria-label="Toggle notifications menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition flex items-center justify-center focus:outline-none"
      >
        <Bell size={18} className={unreadCount > 0 ? "text-primary-300 animate-pulse" : ""} />
        {badgeText && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/40 ring-2 ring-dark-800">
            {badgeText}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 bg-dark-800/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px] animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 text-[10px] font-medium border border-primary-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[11px] text-white/50 hover:text-primary-300 px-2 py-1 rounded-lg hover:bg-white/5 transition"
                >
                  <CheckCheck size={13} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-white/40 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {loading && notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-white/40">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={28} className="text-white/20 mx-auto mb-2" />
                <p className="text-xs font-medium text-white/60">No notifications yet</p>
                <p className="text-[11px] text-white/35 mt-0.5">
                  You'll be alerted when teammates invite you, assign tasks, or post updates.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left p-3.5 flex items-start gap-3 transition group ${
                    n.is_read
                      ? "hover:bg-white/[0.03] text-white/70"
                      : "bg-primary-500/[0.08] hover:bg-primary-500/[0.14] text-white"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                      n.is_read
                        ? "bg-white/5 border-white/5 text-white/50"
                        : "bg-primary-500/20 border-primary-500/30 text-primary-300"
                    }`}
                  >
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs truncate ${
                          n.is_read ? "font-medium text-white/80" : "font-semibold text-white"
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-white/35 shrink-0 whitespace-nowrap">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/55 line-clamp-2 mt-0.5 leading-snug">
                      {n.message}
                    </p>
                    {n.team_name && (
                      <span className="inline-block mt-1 text-[10px] font-medium text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
                        {n.team_name}
                      </span>
                    )}
                  </div>
                  {!n.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary-400 shrink-0 mt-2 ring-2 ring-primary-500/30" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 border-t border-white/10 bg-dark-900/60 flex items-center justify-between text-xs">
            <Link
              to="/teams/notifications"
              onClick={() => setIsOpen(false)}
              className="w-full text-center py-1.5 text-xs font-medium text-primary-300 hover:text-primary-200 hover:bg-white/5 rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <span>View all notifications</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
