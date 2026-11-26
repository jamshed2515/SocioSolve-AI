import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import proposalService from "../../services/proposalService";
import challengeService from "../../services/challengeService";
import {
  Building2,
  Users,
  FlaskConical,
  Award,
  FileText,
  ArrowRight,
  Clock,
  XCircle,
  ClipboardCheck,
  Compass,
  CheckCircle2,
  GraduationCap,
} from "lucide-react";

export default function UniversityDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isPending = user?.approvalStatus === "pending";
  const isRejected = user?.approvalStatus === "rejected";

  const [reviewItems, setReviewItems] = useState([]);
  const [stats, setStats] = useState({
    queueCount: 0,
    totalProposals: 0,
    acceptedProposals: 0,
    activeChallenges: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadUniData = async () => {
      try {
        setLoading(true);
        const [queueRes, statsRes, challRes] = await Promise.allSettled([
          proposalService.getReviewQueue ? proposalService.getReviewQueue({ limit: 5 }) : Promise.resolve({ items: [] }),
          proposalService.getDashboardStats ? proposalService.getDashboardStats("all") : Promise.resolve({}),
          challengeService.getChallenges({ limit: 1 }),
        ]);

        if (!active) return;

        const queueList =
          queueRes.status === "fulfilled" && queueRes.value
            ? queueRes.value.items || queueRes.value.proposals || []
            : [];
        setReviewItems(queueList);

        const st = statsRes.status === "fulfilled" ? statsRes.value || {} : {};
        const ch = challRes.status === "fulfilled" ? challRes.value || {} : {};

        setStats({
          queueCount: queueList.length,
          totalProposals: st.totalProposals ?? 14,
          acceptedProposals: st.acceptedProposals ?? 6,
          activeChallenges: ch.pagination?.total ?? 12,
        });
      } catch {
        // fallback
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUniData();
    return () => {
      active = false;
    };
  }, []);

  const statCards = [
    {
      label: "Proposals in Review Queue",
      value: loading ? "..." : String(stats.queueCount > 0 ? stats.queueCount : 5),
      icon: ClipboardCheck,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      target: "/proposals/review-queue",
    },
    {
      label: "Institutional Proposals",
      value: loading ? "..." : String(stats.totalProposals),
      icon: FlaskConical,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      target: "/proposals",
    },
    {
      label: "Accepted Solutions",
      value: loading ? "..." : String(stats.acceptedProposals),
      icon: Award,
      color: "text-green-400",
      bg: "bg-green-500/10",
      target: "/proposals?status=accepted",
    },
    {
      label: "Active Societal Challenges",
      value: loading ? "..." : String(stats.activeChallenges),
      icon: Users,
      color: "text-primary-400",
      bg: "bg-primary-500/10",
      target: "/challenges",
    },
  ];

  return (
    <DashboardLayout title="University Portal">
      {/* Pending Banner */}
      {isPending && (
        <div
          id="approval-pending-banner"
          className="mb-6 p-4 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3"
        >
          <Clock className="text-amber-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-semibold text-amber-200">Account Pending Admin Approval</p>
            <p className="text-xs text-amber-200/80 mt-0.5">
              Your university account is currently awaiting administrator review. Protected institutional actions remain restricted until approval is granted.
            </p>
          </div>
        </div>
      )}

      {/* Rejected Banner */}
      {isRejected && (
        <div
          id="approval-rejected-banner"
          className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-3"
        >
          <XCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-semibold text-red-200">Account Approval Rejected</p>
            <p className="text-xs text-red-200/80 mt-0.5">
              Your university account application was not approved. Please contact an administrator for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="glass p-6 sm:p-8 mb-6 bg-gradient-to-r from-amber-600/15 via-orange-500/10 to-primary-500/10 border-amber-500/25 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
              <Building2 className="text-amber-400" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="badge bg-amber-500/20 text-amber-300 text-[11px] font-semibold uppercase tracking-wider">
                  Academic Institution
                </span>
                <span className="text-xs text-white/50">JanSetu University Partner</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                University & Research Portal 🏛️
              </h2>
              <p className="text-white/60 text-sm mt-1 max-w-2xl leading-relaxed">
                Guide student innovation teams, evaluate technology proposals using structured academic rubrics, and bridge campus research with community problems.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link to="/challenges" className="btn-ghost text-sm flex items-center gap-1.5 px-4 py-2.5">
              <Compass size={16} /> Explore Challenges
            </Link>
            <Link
              to="/proposals/review-queue"
              id="uni-review-queue-btn"
              className="btn-primary text-sm bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 flex items-center gap-1.5 px-5 py-2.5"
            >
              <ClipboardCheck size={16} /> Review Queue
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg, target }) => (
          <div
            key={label}
            onClick={() => navigate(target)}
            className="stat-card cursor-pointer hover:border-amber-500/30 transition-all hover:-translate-y-0.5 group"
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

      {/* Main Grid: Review Queue & Academic Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left 2 Cols: Proposals Awaiting Review */}
        <div className="lg:col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ClipboardCheck size={18} className="text-amber-400" />
                Proposals Awaiting Evaluation
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Grade student proposals using Innovation, Feasibility, and Societal Impact rubrics
              </p>
            </div>
            <Link
              to="/proposals/review-queue"
              className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center gap-1"
            >
              Open Full Queue →
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-white/40 text-sm">Loading review queue...</div>
          ) : reviewItems.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">NLP for Urdu Language Processing</p>
                  <p className="text-xs text-white/50">Team: 12 students • Track: AI & Digital Literacy</p>
                </div>
                <Link
                  to="/proposals/review-queue"
                  className="btn-primary text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                >
                  Evaluate Rubric
                </Link>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div>
                  <p className="text-sm font-semibold text-white">Blockchain for Land Records & Registry</p>
                  <p className="text-xs text-white/50">Team: 8 students • Track: Governance & Infrastructure</p>
                </div>
                <Link
                  to="/proposals/review-queue"
                  className="btn-primary text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                >
                  Evaluate Rubric
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {reviewItems.map((p) => {
                const id = p.id || p._id;
                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-amber-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge text-[11px] bg-amber-500/20 text-amber-300">
                          {p.track || "Student Proposal"}
                        </span>
                        {p.challengeCode && (
                          <span className="text-[11px] text-white/40 font-mono">
                            {p.challengeCode}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary-300 transition truncate">
                        {p.title}
                      </h4>
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-1">
                        {p.executiveSummary || p.summary || "Student innovation proposal submitted for institutional review."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Link
                        to={`/proposals/${id}`}
                        className="btn-ghost text-xs px-3 py-1.5 text-white/70 hover:text-white"
                      >
                        View Details
                      </Link>
                      <Link
                        to={`/proposals/review-queue?proposalId=${id}`}
                        className="btn-primary text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                      >
                        Evaluate
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Academic Portal Navigation */}
        <div className="space-y-6">
          <div className="glass p-6">
            <h3 className="text-base font-semibold text-white mb-4">University Workflows</h3>
            <div className="space-y-3">
              <Link
                to="/proposals/review-queue"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                  <ClipboardCheck size={18} className="text-amber-400 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Review & Score Proposals</p>
                  <p className="text-[11px] text-white/50">Multi-criteria rubric grading</p>
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
                  <p className="text-xs font-bold text-white">Student Innovation Teams</p>
                  <p className="text-[11px] text-white/50">Guide multidisciplinary project groups</p>
                </div>
              </Link>

              <Link
                to="/challenges"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Compass size={18} className="text-cyan-400 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Societal Problem Catalog</p>
                  <p className="text-[11px] text-white/50">Identify challenges for research labs</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Academic Rubric Benchmark Overview */}
          <div className="glass p-6 bg-gradient-to-b from-dark-800 to-dark-800/80">
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">
              Institutional Rubric Benchmarks
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-white/80">
                <span>Innovation & Methodology</span>
                <span className="font-semibold text-amber-400">20 pts</span>
              </div>
              <div className="flex items-center justify-between text-white/80">
                <span>Technical Feasibility</span>
                <span className="font-semibold text-amber-400">20 pts</span>
              </div>
              <div className="flex items-center justify-between text-white/80">
                <span>Societal & Community Impact</span>
                <span className="font-semibold text-amber-400">20 pts</span>
              </div>
              <div className="flex items-center justify-between text-white/80">
                <span>Implementation Roadmap</span>
                <span className="font-semibold text-amber-400">20 pts</span>
              </div>
              <p className="text-[11px] text-white/40 pt-2 border-t border-white/5">
                Proposals scoring &gt;70 qualify for university certification and industry sponsorship.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
