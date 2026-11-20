import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Calendar,
  Compass,
  Plus,
  RefreshCw,
  Search,
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

export default function ExploreTeams() {
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [challenges, setChallenges] = useState<ChallengeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [teamsRes, challengesRes] = await Promise.all([
        teamApi.getAllTeams({
          page: 1,
          limit: 50,
          search: searchTerm || undefined,
          challenge_id: selectedChallenge !== "all" ? selectedChallenge : undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
        }),
        teamApi.getChallenges().catch(() => []),
      ]);

      setTeams(teamsRes.teams || []);
      setChallenges(challengesRes || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load innovation teams across Jharkhand.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedChallenge, selectedStatus]);

  useEffect(() => {
    const handler = setTimeout(() => {
      void loadTeams();
    }, 250);
    return () => clearTimeout(handler);
  }, [loadTeams]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="glass p-6 bg-gradient-to-r from-accent-400/15 via-dark-700/60 to-primary-500/10 border-accent-400/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-accent-400 font-medium">
              <Compass size={12} />
              <span>Jharkhand Innovation Network</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Explore Active Teams
            </h2>
            <p className="text-xs sm:text-sm text-white/55 max-w-2xl">
              Discover multidisciplinary student and citizen teams formed around societal challenges across Jharkhand districts.
            </p>
          </div>

          <Link
            to="/teams/create"
            className="btn-primary text-xs px-4 py-2.5 shrink-0 shadow-md shadow-primary-500/25"
          >
            <Plus size={16} /> Form a Team
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search teams by title or solution keywords..."
            className="input text-xs sm:text-sm pl-10 py-2.5"
          />
        </div>

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

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="glass p-6 animate-pulse space-y-4">
              <div className="h-4 bg-white/10 rounded w-1/3" />
              <div className="h-6 bg-white/15 rounded w-3/4" />
              <div className="h-12 bg-white/5 rounded" />
              <div className="h-2 bg-white/10 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* Error Notice */}
      {!loading && error && (
        <div className="glass p-8 border-red-500/30 bg-red-500/5 text-center space-y-3">
          <AlertCircle size={24} className="mx-auto text-red-400" />
          <h3 className="text-base font-semibold text-red-200">{error}</h3>
          <button type="button" onClick={loadTeams} className="btn-primary text-xs px-4 py-2">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && teams.length === 0 && (
        <div className="glass p-12 text-center border-dashed border-white/15 space-y-4">
          <Compass size={32} className="mx-auto text-accent-400" />
          <h3 className="text-base font-semibold text-white">No Teams Found</h3>
          <p className="text-xs text-white/50 max-w-md mx-auto">
            No public innovation teams match your search criteria. Be the first to form a team!
          </p>
          <Link to="/teams/create" className="btn-primary text-xs px-5 py-2.5 inline-flex">
            <Plus size={16} /> Create Team
          </Link>
        </div>
      )}

      {/* Teams Grid */}
      {!loading && !error && teams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teams.map((team) => {
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
                className="glass p-6 hover:border-accent-400/40 transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`badge text-[11px] font-semibold border ${statusClass} capitalize`}>
                      {team.status}
                    </span>
                    <span className="text-xs text-white/40">
                      {team.challenge_category || "General"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-accent-300 transition line-clamp-1">
                    {team.name}
                  </h3>

                  <div className="mt-1 flex items-center gap-1.5 text-xs text-accent-400">
                    <Compass size={13} className="shrink-0" />
                    <span className="truncate font-medium">
                      {team.challenge_title || "Societal Challenge"}
                    </span>
                  </div>

                  <p className="text-xs text-white/55 mt-2.5 line-clamp-2 leading-relaxed">
                    {team.description}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-white/10 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                      <span>Roster capacity</span>
                      <span className="font-semibold text-white/80">
                        {team.member_count} / {team.max_members} members
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-accent-400 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

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
