import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import challengeService from "../../services/challengeService";
import proposalService from "../../services/proposalService";
import {
  GraduationCap,
  BookOpen,
  Users,
  Trophy,
  Lightbulb,
  ArrowRight,
  Compass,
  PlusCircle,
  FileText,
  MapPin,
  Sparkles,
} from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [challenges, setChallenges] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [teamsCount, setTeamsCount] = useState(0);
  const [totalChallengesCount, setTotalChallengesCount] = useState(0);
  const [totalProposalsCount, setTotalProposalsCount] = useState(0);
  const [acceptedProposalsCount, setAcceptedProposalsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        setLoading(true);
        const [dashRes, challRes, propRes, teamRes] = await Promise.allSettled([
          proposalService.getRoleDashboard("student"),
          challengeService.getChallenges({ limit: 4 }),
          proposalService.listMyProposals({ limit: 5 }),
          proposalService.getMyTeams ? proposalService.getMyTeams() : Promise.resolve({ teams: [] }),
        ]);

        if (!active) return;

        let loadedChallenges = [];
        if (challRes.status === "fulfilled" && challRes.value) {
          loadedChallenges = challRes.value.items || challRes.value.challenges || [];
          setChallenges(loadedChallenges);
          setTotalChallengesCount(challRes.value.total ?? loadedChallenges.length);
        }

        let loadedProposals = [];
        if (propRes.status === "fulfilled" && propRes.value) {
          loadedProposals = propRes.value.proposals || propRes.value.items || [];
          setProposals(loadedProposals);
          setTotalProposalsCount(propRes.value.total ?? loadedProposals.length);
          setAcceptedProposalsCount(loadedProposals.filter((p) => p.status === "accepted").length);
        }

        if (teamRes.status === "fulfilled" && teamRes.value) {
          const tList = teamRes.value.teams || teamRes.value || [];
          setTeamsCount(Array.isArray(tList) ? tList.length : 0);
        }

        // Prefer authoritative live MongoDB counts from /api/dashboard/student when available
        if (dashRes.status === "fulfilled" && dashRes.value?.stats) {
          const s = dashRes.value.stats;
          if (typeof s.activeChallenges === "number") setTotalChallengesCount(s.activeChallenges);
          if (typeof s.totalMyProposals === "number") setTotalProposalsCount(s.totalMyProposals);
          if (typeof s.acceptedProposals === "number") setAcceptedProposalsCount(s.acceptedProposals);
          if (typeof s.teamProjects === "number") setTeamsCount(s.teamProjects);
          if (loadedChallenges.length === 0 && Array.isArray(dashRes.value.activeChallenges)) {
            setChallenges(dashRes.value.activeChallenges);
          }
        }
      } catch {
        // keep zeroed defaults
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const stats = [
    {
      label: "Challenges to Solve",
      value: loading ? "..." : String(totalChallengesCount),
      icon: Lightbulb,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      target: "/challenges",
    },
    {
      label: "My Proposals",
      value: loading ? "..." : String(totalProposalsCount),
      icon: BookOpen,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      target: "/proposals/my",
    },
    {
      label: "Team Collaborations",
      value: loading ? "..." : String(teamsCount),
      icon: Users,
      color: "text-primary-400",
      bg: "bg-primary-500/10",
      target: "/teams",
    },
    {
      label: "Accepted Solutions",
      value: loading ? "..." : String(acceptedProposalsCount),
      icon: Trophy,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      target: "/proposals/my",
    },
  ];

  return (
    <DashboardLayout title="Student Dashboard">
      {/* Welcome Banner */}
      <div className="glass p-6 sm:p-8 mb-6 bg-gradient-to-r from-violet-600/15 via-purple-500/10 to-primary-500/10 border-violet-500/25 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/10">
              <GraduationCap className="text-violet-400" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="badge bg-violet-500/20 text-violet-300 text-[11px] font-semibold uppercase tracking-wider">
                  Innovator Portal
                </span>
                <span className="text-xs text-white/50">JanSetu Student Hub</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Welcome back, {user?.name || "Student"}! 🎓
              </h2>
              <p className="text-white/60 text-sm mt-1 max-w-2xl leading-relaxed">
                Discover real societal problems submitted by citizens. Form student teams, engineer prototype solutions, and submit proposals for university evaluation and industry grants.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link to="/challenges" className="btn-ghost text-sm flex items-center gap-1.5 px-4 py-2.5">
              <Compass size={16} /> Explore Challenges
            </Link>
            <Link
              to="/proposals/new"
              id="student-browse-btn"
              className="btn-primary text-sm flex items-center gap-1.5 px-5 py-2.5 shadow-lg shadow-primary-500/20"
            >
              <PlusCircle size={16} /> Submit Proposal
            </Link>
          </div>
        </div>
      </div>

      {/* Live KPI Stats from MongoDB */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, target }) => (
          <div
            key={label}
            onClick={() => navigate(target)}
            className="stat-card cursor-pointer hover:border-violet-500/30 transition-all hover:-translate-y-0.5 group"
          >
            <div className="flex items-center justify-between">
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={color} size={22} />
              </div>
              <ArrowRight size={16} className="text-white/20 group-hover:text-primary-400 transition" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-white mt-3">{value}</p>
            <p className="text-xs font-medium text-white/50 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid: Challenges to Solve & My Proposals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left 2 Cols: Active Societal Challenges Ready for Solutions */}
        <div className="lg:col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-violet-400" />
                Active Challenges Ready for Solutions
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Civic problems seeking innovative technology proposals
              </p>
            </div>
            <Link to="/challenges" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
              Browse All →
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-white/40 text-sm">Loading challenges...</div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
              <Lightbulb size={28} className="text-violet-400 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-white">No challenges available right now</p>
              <p className="text-xs text-white/50 mt-1">Check back soon for new community issues.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {challenges.map((c) => {
                const id = c.id || c._id;
                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-violet-500/30 transition group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="badge text-[11px] bg-violet-500/20 text-violet-300">
                          {c.category || "General"}
                        </span>
                        {c.difficulty && (
                          <span className="badge text-[11px] bg-white/10 text-white/60">
                            {c.difficulty}
                          </span>
                        )}
                        {c.location && (
                          <span className="text-[11px] text-white/40 flex items-center gap-1">
                            <MapPin size={11} /> {c.location}
                          </span>
                        )}
                      </div>
                      <h4
                        onClick={() => navigate(`/challenges/${id}`)}
                        className="text-sm font-semibold text-white group-hover:text-primary-300 transition cursor-pointer truncate"
                      >
                        {c.title}
                      </h4>
                      <p className="text-xs text-white/40 line-clamp-1 mt-0.5">
                        {c.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Link
                        to={`/challenges/${id}`}
                        className="btn-ghost text-xs px-3 py-1.5 text-white/70 hover:text-white"
                      >
                        Details
                      </Link>
                      <Link
                        to={`/proposals/new?challengeId=${id}`}
                        className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                      >
                        Solve <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Student Tools & Proposals Summary */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="glass p-6">
            <h3 className="text-base font-semibold text-white mb-4">Student Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/proposals/new"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 text-violet-300 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                  <PlusCircle size={18} className="text-violet-400 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Submit Solution Proposal</p>
                  <p className="text-[11px] text-white/50">Pitch implementation plan & prototype</p>
                </div>
              </Link>

              <Link
                to="/teams"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Users size={18} className="text-primary-400 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Team Collaboration</p>
                  <p className="text-[11px] text-white/50">Form project teams with peers</p>
                </div>
              </Link>

              <Link
                to="/proposals/my"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-cyan-400 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">My Proposals</p>
                  <p className="text-[11px] text-white/50">Track reviews, rubric scores & feedback</p>
                </div>
              </Link>
            </div>
          </div>

          {/* My Recent Proposals Widget */}
          <div className="glass p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">My Proposals Status</h4>
              <Link to="/proposals/my" className="text-xs text-primary-400 hover:underline">
                View All
              </Link>
            </div>

            {proposals.length === 0 ? (
              <p className="text-xs text-white/40 py-4 text-center">
                You haven't submitted any proposals yet. Select an active challenge to begin!
              </p>
            ) : (
              <div className="space-y-2.5">
                {proposals.slice(0, 3).map((p) => {
                  const id = p.id || p._id;
                  const status = (p.status || "submitted").toLowerCase();
                  return (
                    <div
                      key={id}
                      onClick={() => navigate(`/proposals/${id}`)}
                      className="p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition cursor-pointer flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-medium text-white truncate">{p.title}</p>
                        <p className="text-[10px] text-white/40 mt-0.5">{p.proposalCode || p.track || "Tech Solution"}</p>
                      </div>
                      <span
                        className={`badge text-[10px] uppercase ${
                          status === "accepted"
                            ? "bg-green-500/20 text-green-300"
                            : status === "under_review"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}
                      >
                        {status.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
