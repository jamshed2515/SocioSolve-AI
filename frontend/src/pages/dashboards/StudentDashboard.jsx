import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import proposalService from "../../services/proposalService";
import { GraduationCap, BookOpen, Users, Trophy, Lightbulb, ArrowRight } from "lucide-react";

const DIFFICULTY_BADGE = {
  Easy: "bg-green-500/20 text-green-300",
  Medium: "bg-amber-500/20 text-amber-300",
  Hard: "bg-red-500/20 text-red-300",
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashStats, setDashStats] = useState({
    activeChallenges: 0,
    teamProjects: 0,
    proposalsSubmitted: 0,
    pointsEarned: 0,
  });
  const [challenges, setChallenges] = useState([]);

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const data = await proposalService.getRoleDashboard("student");
        if (!active) return;
        if (data?.stats) {
          setDashStats({
            activeChallenges: data.stats.activeChallenges ?? 0,
            teamProjects: data.stats.teamProjects ?? 0,
            proposalsSubmitted: data.stats.proposalsSubmitted ?? 0,
            pointsEarned: data.stats.pointsEarned ?? 0,
          });
        }
        if (Array.isArray(data?.activeChallenges)) {
          setChallenges(data.activeChallenges);
        }
      } catch {
        // Fallback: query Module 4 stats & published challenges directly if dashboard endpoint is unavailable
        try {
          const [pStats, chRes] = await Promise.all([
            proposalService.getDashboardStats("mine"),
            proposalService.getPublishedChallenges(),
          ]);
          if (!active) return;
          const pubCh = chRes?.challenges || [];
          setDashStats({
            activeChallenges: pubCh.length,
            teamProjects: 0,
            proposalsSubmitted:
              (pStats?.submittedProposals || 0) +
              (pStats?.underReviewProposals || 0) +
              (pStats?.acceptedProposals || 0) +
              (pStats?.rejectedProposals || 0),
            pointsEarned: 0,
          });
          setChallenges(pubCh.slice(0, 5));
        } catch {
          // keep zeroed defaults
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const statCards = [
    {
      label: "Active Challenges",
      value: loading ? "—" : String(dashStats.activeChallenges),
      icon: Lightbulb,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      to: "/proposals/new",
    },
    {
      label: "Team Projects",
      value: loading ? "—" : String(dashStats.teamProjects),
      icon: Users,
      color: "text-primary-400",
      bg: "bg-primary-500/10",
      to: "/teams/my-teams",
    },
    {
      label: "Proposals Submitted",
      value: loading ? "—" : String(dashStats.proposalsSubmitted),
      icon: BookOpen,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      to: "/proposals/my",
    },
    {
      label: "Evaluation Score Points",
      value: loading ? "—" : String(dashStats.pointsEarned),
      icon: Trophy,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      to: "/proposals/my",
    },
  ];

  return (
    <DashboardLayout title="Student Dashboard">
      {/* Welcome banner */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <GraduationCap className="text-violet-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Student Hub 🎓</h2>
            <p className="text-white/50 text-sm">Join challenges, build teams, submit solutions.</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/proposals" className="btn-ghost text-sm">
              Proposals Hub
            </Link>
            <Link to="/proposals/new" id="student-browse-btn" className="btn-primary text-sm">
              Submit Proposal <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* Live Stats from MongoDB */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ label, value, icon: Icon, color, bg, to }) => (
          <div key={label} onClick={() => navigate(to)} className="stat-card cursor-pointer">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={color} size={20} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/50">{label}</p>
          </div>
        ))}
      </div>

      {/* Live Published Challenges */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Active Published Challenges</h3>
          <Link to="/proposals/new" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
            Browse All & Propose Solution →
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : challenges.length === 0 ? (
          <div className="text-center py-8 bg-white/5 rounded-xl border border-white/5">
            <p className="text-sm text-white/60">No published challenges available yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {challenges.map((c) => (
              <div
                key={c.id}
                onClick={() => navigate(`/proposals/new?challengeId=${c.id}`)}
                className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/8 transition cursor-pointer group"
              >
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-primary-400 transition">
                    {c.title}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {c.category || "General"}
                    {c.location ? ` · ${c.location}` : ""}
                    {c.deadline ? ` · Deadline: ${c.deadline}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.difficulty && (
                    <span className={`badge ${DIFFICULTY_BADGE[c.difficulty] || "bg-primary-500/20 text-primary-300"}`}>
                      {c.difficulty}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-white/30 group-hover:text-primary-400 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
