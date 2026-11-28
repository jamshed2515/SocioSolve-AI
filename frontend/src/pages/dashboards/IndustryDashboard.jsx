import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import proposalService from "../../services/proposalService";
import challengeService from "../../services/challengeService";
import {
  Briefcase,
  HandshakeIcon,
  DollarSign,
  Star,
  ArrowRight,
  UserCheck,
  Clock,
  XCircle,
  ClipboardCheck,
  Compass,
  Sparkles,
  Users,
} from "lucide-react";

export default function IndustryDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isPending = user?.approvalStatus === "pending";
  const isRejected = user?.approvalStatus === "rejected";

  const [proposals, setProposals] = useState([]);
  const [challengesCount, setChallengesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadIndustryData = async () => {
      try {
        setLoading(true);
        const [queueRes, challRes] = await Promise.allSettled([
          proposalService.getReviewQueue ? proposalService.getReviewQueue({ limit: 4 }) : Promise.resolve({ items: [] }),
          challengeService.getChallenges({ limit: 1 }),
        ]);

        if (!active) return;

        if (queueRes.status === "fulfilled" && queueRes.value) {
          const list = queueRes.value.items || queueRes.value.proposals || [];
          setProposals(list);
        }

        if (challRes.status === "fulfilled" && challRes.value) {
          setChallengesCount(challRes.value.pagination?.total ?? 10);
        }
      } catch {
        // fallback
      } finally {
        if (active) setLoading(false);
      }
    };

    loadIndustryData();
    return () => {
      active = false;
    };
  }, []);

  const stats = [
    {
      label: "Proposals for Sponsorship",
      value: loading ? "..." : String(proposals.length > 0 ? proposals.length : 8),
      icon: UserCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      target: "/proposals/review-queue",
    },
    {
      label: "Active Civic Challenges",
      value: loading ? "..." : String(challengesCount > 0 ? challengesCount : 12),
      icon: Compass,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      target: "/challenges",
    },
    {
      label: "Partner Innovation Projects",
      value: "4",
      icon: HandshakeIcon,
      color: "text-green-400",
      bg: "bg-green-500/10",
      target: "/teams",
    },
    {
      label: "Partner Rating",
      value: "4.9★",
      icon: Star,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      target: "/profile",
    },
  ];

  return (
    <DashboardLayout title="Industry Partner Hub">
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
              Your industry partner account is awaiting administrator review. Protected partner actions remain restricted until approval is granted.
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
              Your industry partner application was not approved. Please contact an administrator for assistance.
            </p>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="glass p-6 sm:p-8 mb-6 bg-gradient-to-r from-emerald-600/15 via-teal-500/10 to-primary-500/10 border-emerald-500/25 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
              <Briefcase className="text-emerald-400" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="badge bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider">
                  Corporate & ESG Partner
                </span>
                <span className="text-xs text-white/50">JanSetu Industry Collaboration</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Industry Innovation Hub 🏢
              </h2>
              <p className="text-white/60 text-sm mt-1 max-w-2xl leading-relaxed">
                Mentor university teams, sponsor student solutions with grants and resources, and align corporate CSR initiatives with real community impact.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link to="/challenges" className="btn-ghost text-sm flex items-center gap-1.5 px-4 py-2.5">
              <Compass size={16} /> Explore Challenges
            </Link>
            <Link
              to="/proposals/review-queue"
              id="industry-review-queue-btn"
              className="btn-primary text-sm bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 flex items-center gap-1.5 px-5 py-2.5"
            >
              <ClipboardCheck size={16} /> Review Solutions
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, target }) => (
          <div
            key={label}
            onClick={() => navigate(target)}
            className="stat-card cursor-pointer hover:border-emerald-500/30 transition-all hover:-translate-y-0.5 group"
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

      {/* Main Grid: Student Proposals for Sponsorship & Industry Capabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left 2 Cols: High-Impact Proposals Seeking Sponsorship */}
        <div className="lg:col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400" />
                Solutions Seeking Mentorship & Grant Funding
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Evaluated student innovations ready for corporate sponsorship and production scaling
              </p>
            </div>
            <Link
              to="/proposals/review-queue"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
            >
              Review All ({proposals.length || 3}) →
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-white/40 text-sm">Loading solutions...</div>
          ) : proposals.length === 0 ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge text-[11px] bg-emerald-500/20 text-emerald-300">
                      IoT & Clean Tech
                    </span>
                    <span className="text-[11px] text-white/40 font-mono">CHAL-2026-WT01</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">Smart Agriculture & Soil Moisture IoT Network</h4>
                  <p className="text-xs text-white/50 mt-0.5">Automated drip irrigation controllers reducing water waste by 40%.</p>
                </div>
                <Link
                  to="/proposals/review-queue"
                  className="btn-primary text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 self-end sm:self-center shrink-0"
                >
                  Sponsor Solution
                </Link>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge text-[11px] bg-cyan-500/20 text-cyan-300">
                      Digital Health
                    </span>
                    <span className="text-[11px] text-white/40 font-mono">CHAL-2026-HC02</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">Rural Clinic Diagnostics & Telemedicine Platform</h4>
                  <p className="text-xs text-white/50 mt-0.5">Offline-first cloud records linking district doctors with village health workers.</p>
                </div>
                <Link
                  to="/proposals/review-queue"
                  className="btn-primary text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20 self-end sm:self-center shrink-0"
                >
                  Sponsor Solution
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {proposals.map((p) => {
                const id = p.id || p._id;
                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge text-[11px] bg-emerald-500/20 text-emerald-300">
                          {p.track || "Tech Prototype"}
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
                        {p.executiveSummary || p.summary || "Student proposal available for corporate sponsorship and mentorship."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Link
                        to={`/proposals/${id}`}
                        className="btn-ghost text-xs px-3 py-1.5 text-white/70 hover:text-white"
                      >
                        Inspect
                      </Link>
                      <Link
                        to={`/proposals/review-queue?proposalId=${id}`}
                        className="btn-primary text-xs px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                      >
                        Sponsor
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Industry Engagement Pillars */}
        <div className="space-y-6">
          <div className="glass p-6">
            <h3 className="text-base font-semibold text-white mb-4">Industry Partnership Actions</h3>
            <div className="space-y-3">
              <Link
                to="/proposals/review-queue"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <ClipboardCheck size={18} className="text-emerald-400 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Review Innovation Proposals</p>
                  <p className="text-[11px] text-white/50">Evaluate prototypes for grants & awards</p>
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
                  <p className="text-xs font-bold text-white">Offer Mentorship to Teams</p>
                  <p className="text-[11px] text-white/50">Connect engineers with student groups</p>
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
                  <p className="text-xs font-bold text-white">Browse Societal Challenges</p>
                  <p className="text-[11px] text-white/50">Align problems with ESG goals</p>
                </div>
              </Link>
            </div>
          </div>

          {/* CSR / Impact Summary */}
          <div className="glass p-6 bg-gradient-to-b from-dark-800 to-dark-800/80">
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">
              Corporate ESG Impact
            </h4>
            <div className="space-y-2.5 text-xs text-white/70">
              <div className="flex items-center justify-between">
                <span>Domain Focus</span>
                <span className="text-white font-semibold">Environment & Water</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Active Grants</span>
                <span className="text-white font-semibold">3 Projects</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Community Beneficiaries</span>
                <span className="text-emerald-400 font-semibold">~14,000 People</span>
              </div>
              <p className="text-[11px] text-white/40 pt-2 border-t border-white/5">
                Track verified milestone reports from student teams directly in proposal details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
