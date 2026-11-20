import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  Compass,
  Crown,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { ChallengeOption, Team } from "../types";

const STATUS_BADGE: Record<string, string> = {
  recruiting: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  full: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  active: "bg-primary-500/20 text-primary-300 border-primary-500/30",
  completed: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

export default function MyTeams() {
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [challenges, setChallenges] = useState<ChallengeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [teamsRes, challengesRes] = await Promise.all([
        teamApi.getMyTeams(1, 50),
        teamApi.getChallenges().catch(() => []),
      ]);

      setTeams(teamsRes.teams || []);
      setChallenges(challengesRes || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Unable to load your teams. Please check backend connection.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Client-side filtering across loaded teams
  const filteredTeams = teams.filter((team) => {
    const matchSearch =
      !searchTerm.trim() ||
      team.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      team.description.toLowerCase().includes(searchTerm.toLowerCase().trim());

    const matchChallenge =
      selectedChallenge === "all" || team.challenge_id === selectedChallenge;

    const matchStatus =
      selectedStatus === "all" || team.status.toLowerCase() === selectedStatus.toLowerCase();

    return matchSearch && matchChallenge && matchStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Page Header Banner ────────────────────────────────────────── */}
      <div className="glass p-6 bg-gradient-to-r from-primary-500/15 via-dark-700/60 to-accent-400/10 border-primary-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-accent-400 font-medium">
              <Users size={12} />
              <span>Module 3 · Team Workspace</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              My Collaborative Teams
            </h2>
            <p className="text-xs sm:text-sm text-white/55 max-w-2xl">
              Teams you lead or collaborate with tackling societal challenges across Jharkhand.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={loadData}
              title="Refresh teams"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <Link
              to="/teams/create"
              className="btn-primary text-xs px-4 py-2.5 shadow-md shadow-primary-500/25"
            >
              <Plus size={16} /> Create Team
            </Link>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────── */}
      <div className="glass p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search teams by name or description..."
            className="input text-xs sm:text-sm pl-10 py-2.5"
          />
        </div>

        {/* Challenge Filter */}
        <div className="w-full md:w-56">
          <select
            value={selectedChallenge}
            onChange={(e) => setSelectedChallenge(e.target.value)}
            className="input text-xs sm:text-sm py-2.5 bg-dark-700 text-white cursor-pointer"
          >
            <option value="all">All Challenges</option>
            {challenges.map((c) => (
              <option key={c.id} value={c.id} className="bg-dark-800 text-white">
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-44">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="input text-xs sm:text-sm py-2.5 bg-dark-700 text-white cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="recruiting">Recruiting</option>
            <option value="full">Full</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* ── Loading Skeleton State ────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="glass p-6 animate-pulse space-y-4 border-white/5"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-white/10 rounded w-1/3" />
                <div className="h-5 bg-white/10 rounded-full w-20" />
              </div>
              <div className="h-5 bg-white/15 rounded w-2/3" />
              <div className="h-12 bg-white/5 rounded" />
              <div className="h-2 bg-white/10 rounded-full" />
              <div className="pt-3 border-t border-white/5 flex justify-between">
                <div className="h-4 bg-white/10 rounded w-24" />
                <div className="h-4 bg-white/10 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error State ───────────────────────────────────────────────── */}
      {!loading && error && (
        <div className="glass p-8 border-red-500/30 bg-red-500/5 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-base font-semibold text-red-200">
            Failed to Load Teams
          </h3>
          <p className="text-xs text-red-200/70 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 btn-primary text-xs px-4 py-2 mt-2"
          >
            <RefreshCw size={13} /> Try Again
          </button>
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────────────── */}
      {!loading && !error && filteredTeams.length === 0 && (
        <div className="glass p-12 text-center border-dashed border-white/15 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center mx-auto text-primary-400">
            <Users size={28} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {teams.length === 0 ? "No Teams Formed Yet" : "No Matching Teams"}
            </h3>
            <p className="text-xs text-white/50 mt-1 max-w-md mx-auto">
              {teams.length === 0
                ? "You haven't formed or joined any innovation teams yet. Start by creating a team or exploring open challenges."
                : "No teams matched your current search filters. Try adjusting your search query or challenge filter."}
            </p>
          </div>
          {teams.length === 0 && (
            <Link to="/teams/create" className="btn-primary text-xs px-5 py-2.5 inline-flex">
              <Plus size={16} /> Create Your First Team
            </Link>
          )}
        </div>
      )}

      {/* ── Teams Cards Grid ──────────────────────────────────────────── */}
      {!loading && !error && filteredTeams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeams.map((team) => {
            const percent = Math.min(
              100,
              Math.round((team.member_count / (team.max_members || 6)) * 100)
            );
            const statusClass =
              STATUS_BADGE[team.status.toLowerCase()] ||
              "bg-white/10 text-white/70 border-white/15";

            const createdDate = new Date(team.created_at).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric", year: "numeric" }
            );

            return (
              <div
                key={team.id}
                onClick={() => navigate(`/teams/${team.id}`)}
                className="glass p-6 hover:border-primary-500/40 transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`badge text-[11px] font-semibold border ${statusClass} capitalize`}
                    >
                      {team.status}
                    </span>

                    {team.is_leader ? (
                      <span className="badge text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                        <Crown size={11} className="text-amber-400" /> Leader
                      </span>
                    ) : (
                      <span className="badge text-[10px] bg-white/5 text-white/60">
                        Member
                      </span>
                    )}
                  </div>

                  {/* Team Title */}
                  <h3 className="text-base font-bold text-white group-hover:text-primary-300 transition line-clamp-1">
                    {team.name}
                  </h3>

                  {/* Challenge Badge / Context */}
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-accent-400">
                    <Compass size={13} className="shrink-0" />
                    <span className="truncate font-medium">
                      {team.challenge_title || "Societal Challenge"}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-white/55 mt-2.5 line-clamp-2 leading-relaxed">
                    {team.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
                  {/* Capacity progress */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                      <span>Roster capacity</span>
                      <span className="font-semibold text-white/80">
                        {team.member_count} / {team.max_members} members
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-accent-400 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center justify-between text-[11px] text-white/45 pt-1">
                    <span className="truncate">
                      Lead: <strong className="text-white/70 font-medium">{team.leader_name}</strong>
                    </span>
                    <span className="shrink-0 flex items-center gap-1">
                      <Calendar size={11} /> {createdDate}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
