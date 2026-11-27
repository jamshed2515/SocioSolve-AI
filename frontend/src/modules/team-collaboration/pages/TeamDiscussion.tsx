import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  Pin,
  Lock,
  Clock,
  Users,
  Compass,
  RefreshCw,
  AlertCircle,
  Tag,
  Crown,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import CreateDiscussionModal from "../components/CreateDiscussionModal";
import DiscussionThreadView from "../components/DiscussionThreadView";
import type { DiscussionCategory, Team, TeamDiscussion } from "../types";

const CATEGORIES = [
  "all",
  "General",
  "Ideas",
  "Technical",
  "Resources",
  "Announcements",
  "Questions",
];

export default function TeamDiscussion() {
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Discussions state
  const [discussions, setDiscussions] = useState<TeamDiscussion[]>([]);
  const [loadingDiscussions, setLoadingDiscussions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [editingDiscussion, setEditingDiscussion] = useState<TeamDiscussion | null>(null);

  // 1. Load user's teams
  useEffect(() => {
    async function loadTeams() {
      setLoadingTeams(true);
      try {
        const res = await teamApi.getMyTeams(1, 50);
        const teams = res.items || [];
        setMyTeams(teams);
        if (teams.length > 0) {
          setSelectedTeamId(teams[0].id);
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail || "Failed to load your teams.";
        setError(msg);
      } finally {
        setLoadingTeams(false);
      }
    }
    void loadTeams();
  }, []);

  // 2. Load discussions for selected team
  const loadDiscussions = useCallback(async () => {
    if (!selectedTeamId) {
      setDiscussions([]);
      return;
    }
    setLoadingDiscussions(true);
    setError(null);
    try {
      const res = await teamApi.getTeamDiscussions(selectedTeamId, {
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        search: searchQuery.trim() || undefined,
        sort: sortOrder,
        limit: 50,
      });
      setDiscussions(res.items || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load team discussions.";
      setError(msg);
    } finally {
      setLoadingDiscussions(false);
    }
  }, [selectedTeamId, selectedCategory, searchQuery, sortOrder]);

  useEffect(() => {
    void loadDiscussions();
  }, [loadDiscussions]);

  const selectedTeam = myTeams.find((t) => t.id === selectedTeamId);

  const getCategoryClass = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case "announcements":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "technical":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      case "ideas":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "resources":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "questions":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      default:
        return "bg-primary-500/20 text-primary-300 border-primary-500/30";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <MessageSquare size={24} className="text-primary-400" /> Team Discussions
          </h1>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            Collaborate, brainstorm ideas, share resources, and resolve challenges with your team.
          </p>
        </div>

        {selectedTeam && (
          <button
            type="button"
            onClick={() => {
              setEditingDiscussion(null);
              setIsCreateModalOpen(true);
            }}
            className="btn btn-primary text-xs self-start sm:self-auto flex items-center gap-1.5"
          >
            <Plus size={14} /> Start Discussion
          </button>
        )}
      </div>

      {/* ── Team Selector & Actions Bar ───────────────────────────────── */}
      {myTeams.length > 0 ? (
        <div className="glass p-4 rounded-2xl border border-white/10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Team Picker */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs text-white/50 shrink-0 flex items-center gap-1">
                <Users size={14} className="text-primary-400" /> Active Team:
              </span>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="input text-xs font-semibold text-white bg-dark-900 border-white/15 max-w-xs truncate"
              >
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id} className="bg-dark-900 text-white">
                    {t.name} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input & Sort Selector */}
            <div className="flex items-center gap-2.5 flex-1 md:justify-end">
              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search discussions..."
                  className="input pl-8 pr-3 text-xs w-full"
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              </div>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "latest" | "oldest")}
                className="input text-xs bg-dark-900 border-white/15 shrink-0"
              >
                <option value="latest" className="bg-dark-900 text-white">Latest</option>
                <option value="oldest" className="bg-dark-900 text-white">Oldest</option>
              </select>

              <button
                type="button"
                onClick={() => void loadDiscussions()}
                disabled={loadingDiscussions}
                className="btn btn-secondary text-xs p-2 shrink-0"
                title="Refresh discussions"
              >
                <RefreshCw size={13} className={loadingDiscussions ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition capitalize whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-primary-500 text-white shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {cat === "all" ? "All Categories" : cat}
              </button>
            ))}
          </div>
        </div>
      ) : (
        !loadingTeams && (
          <div className="glass p-10 text-center rounded-2xl border border-white/10 space-y-3">
            <Users size={32} className="mx-auto text-white/30" />
            <h3 className="text-base font-bold text-white">You are not in any teams yet</h3>
            <p className="text-xs text-white/50 max-w-md mx-auto">
              Discussions are private to active team squads. Create or join a team to start collaborating on Jharkhand societal challenges.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link to="/teams/create" className="btn btn-primary text-xs">
                Create Team
              </Link>
              <Link to="/teams/explore" className="btn btn-secondary text-xs">
                Explore Teams
              </Link>
            </div>
          </div>
        )
      )}

      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Loading Skeleton ──────────────────────────────────────────── */}
      {loadingDiscussions && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass p-5 rounded-2xl border border-white/10 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="h-4 bg-white/10 rounded w-20" />
              </div>
              <div className="h-3 bg-white/10 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* ── Empty Discussions State ────────────────────────────────────── */}
      {!loadingDiscussions && selectedTeamId && discussions.length === 0 && (
        <div className="glass p-12 text-center rounded-2xl border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 text-white/40 flex items-center justify-center mx-auto">
            <MessageSquare size={24} />
          </div>
          <h3 className="text-base font-semibold text-white">No discussions found</h3>
          <p className="text-xs text-white/40 max-w-sm mx-auto">
            {searchQuery || selectedCategory !== "all"
              ? "No discussions match your filter criteria. Try clearing search or selecting a different category."
              : `No discussions have been posted in ${selectedTeam?.name || "this team"} yet. Start the dialogue!`}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingDiscussion(null);
              setIsCreateModalOpen(true);
            }}
            className="btn btn-primary text-xs inline-flex items-center gap-1.5 mt-2"
          >
            <Plus size={14} /> Start First Discussion
          </button>
        </div>
      )}

      {/* ── Discussions Cards List ─────────────────────────────────────── */}
      {!loadingDiscussions && discussions.length > 0 && (
        <div className="space-y-3.5">
          {discussions.map((disc) => {
            const dateStr = new Date(disc.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={disc.id}
                onClick={() => setActiveThreadId(disc.id)}
                className={`glass p-5 rounded-2xl border transition-all cursor-pointer hover:border-primary-500/40 hover:bg-white/[0.04] space-y-3 ${
                  disc.is_pinned
                    ? "border-amber-500/30 bg-amber-500/[0.02]"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {/* Header Row: Category, Pinned, Locked, Date */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`badge text-[10px] font-semibold border ${getCategoryClass(disc.category)} capitalize`}>
                      <Tag size={10} className="mr-1 inline" /> {disc.category}
                    </span>

                    {disc.is_pinned && (
                      <span className="badge text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                        <Pin size={10} className="text-amber-400" /> Pinned
                      </span>
                    )}

                    {disc.is_locked && (
                      <span className="badge text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-semibold">
                        <Lock size={10} className="text-rose-400" /> Locked
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-white/40 flex items-center gap-1">
                    <Clock size={11} /> {dateStr}
                  </span>
                </div>

                {/* Title & Preview */}
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-primary-300 transition-colors">
                    {disc.title}
                  </h3>
                  <p className="text-xs text-white/65 line-clamp-2 mt-1 leading-relaxed">
                    {disc.content}
                  </p>
                </div>

                {/* Footer: Author & Comments Count */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-white/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center font-bold text-[10px] text-white">
                      {disc.author_name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <span className="font-medium text-white/80 flex items-center gap-1">
                      {disc.author_name}
                      {disc.author_role === "Team Leader" && (
                        <Crown size={11} className="text-amber-400" />
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-primary-300 font-semibold text-xs">
                    <MessageSquare size={13} />
                    <span>{disc.comment_count} {disc.comment_count === 1 ? "comment" : "comments"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Discussion Modal ─────────────────────────────── */}
      {isCreateModalOpen && selectedTeam && (
        <CreateDiscussionModal
          isOpen={isCreateModalOpen}
          teamId={selectedTeam.id}
          teamName={selectedTeam.name}
          initialDiscussion={editingDiscussion}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingDiscussion(null);
          }}
          onSuccess={() => {
            void loadDiscussions();
          }}
        />
      )}

      {/* ── Discussion Thread Detail View ──────────────────────────────── */}
      {activeThreadId && (
        <DiscussionThreadView
          discussionId={activeThreadId}
          onClose={() => setActiveThreadId(null)}
          onDiscussionDeleted={() => {
            setActiveThreadId(null);
            void loadDiscussions();
          }}
          onDiscussionUpdated={() => {
            void loadDiscussions();
          }}
          onEditDiscussion={(disc) => {
            setEditingDiscussion(disc);
            setIsCreateModalOpen(true);
          }}
        />
      )}
    </div>
  );
}
