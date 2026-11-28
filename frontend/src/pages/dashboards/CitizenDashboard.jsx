import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import challengeService from "../../services/challengeService";
import {
  MapPin,
  AlertCircle,
  Clock,
  CheckCircle2,
  Plus,
  Compass,
  Layers,
  ArrowRight,
  TrendingUp,
  Droplets,
  Trash2,
  Car,
  HeartPulse,
  GraduationCap,
  Trees,
  Eye,
} from "lucide-react";

const CATEGORY_TILES = [
  { label: "Water Supply & Shortage", key: "Environment & Water", icon: Droplets, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { label: "Waste Management & Sanitation", key: "Environment & Water", icon: Trash2, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  { label: "Roads & Traffic Congestion", key: "Infrastructure & Energy", icon: Car, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { label: "Healthcare & Cleanliness", key: "Healthcare & Well-being", icon: HeartPulse, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  { label: "Education & Literacy", key: "Education & Literacy", icon: GraduationCap, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { label: "River & Air Pollution", key: "Agriculture & Rural Development", icon: Trees, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/20" },
];

export default function CitizenDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    underReview: 0,
    published: 0,
    resolved: 0,
  });

  useEffect(() => {
    let active = true;
    const fetchCitizenData = async () => {
      try {
        setLoading(true);
        const data = await challengeService.getMyChallenges({ limit: 10 });
        if (!active) return;
        const items = data.items || [];
        setChallenges(items.slice(0, 5));

        const total = data.pagination?.total ?? items.length;
        const underReview = items.filter((c) => c.status === "submitted" || c.status === "draft").length;
        const published = items.filter((c) => c.status === "published" || c.status === "in_progress").length;
        const resolved = items.filter((c) => c.status === "resolved" || c.status === "closed").length;

        setStats({ total, underReview, published, resolved });
      } catch {
        // graceful fallback if network unavailable
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchCitizenData();
    return () => {
      active = false;
    };
  }, []);

  const statCards = [
    {
      label: "Problems Reported",
      value: loading ? "..." : String(stats.total),
      icon: AlertCircle,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      target: "/my-challenges",
    },
    {
      label: "Live in Catalog",
      value: loading ? "..." : String(stats.published),
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-500/10",
      target: "/my-challenges?status=published",
    },
    {
      label: "Under Review / Draft",
      value: loading ? "..." : String(stats.underReview),
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      target: "/my-challenges?status=submitted",
    },
    {
      label: "Resolved",
      value: loading ? "..." : String(stats.resolved),
      icon: CheckCircle2,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      target: "/my-challenges?status=resolved",
    },
  ];

  return (
    <DashboardLayout title="Citizen Portal">
      {/* Welcome Banner */}
      <div className="glass p-6 sm:p-8 mb-6 bg-gradient-to-r from-blue-600/15 via-cyan-500/10 to-primary-500/10 border-blue-500/25 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/10">
              <MapPin className="text-blue-400" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="badge bg-blue-500/20 text-blue-300 text-[11px] font-semibold uppercase tracking-wider">
                  Citizen Voice
                </span>
                <span className="text-xs text-white/50">JanSetu Civic Connect</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Welcome back, {user?.name || "Citizen"}! 🏘️
              </h2>
              <p className="text-white/60 text-sm mt-1 max-w-2xl leading-relaxed">
                Report local civic, water, waste, and infrastructure problems. Student teams and university researchers collaborate to engineer actionable solutions for your community.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              to="/challenges/new"
              id="citizen-report-btn"
              className="btn-primary text-sm inline-flex items-center justify-center gap-2 w-full md:w-auto px-5 py-3 shadow-lg shadow-primary-500/25"
            >
              <Plus size={18} /> Report a Problem
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
            className="stat-card cursor-pointer hover:border-primary-500/30 transition-all hover:-translate-y-0.5 group"
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

      {/* Main Grid: My Reports & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Left 2 Cols: My Recent Reported Issues */}
        <div className="lg:col-span-2 glass p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Layers size={18} className="text-primary-400" />
                My Recent Reports
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                Track status updates and student solution progress
              </p>
            </div>
            <Link
              to="/my-challenges"
              className="text-xs text-primary-400 hover:text-primary-300 font-medium inline-flex items-center gap-1"
            >
              View All ({stats.total}) →
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-white/40 text-sm">
              Loading your submitted problems...
            </div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3 text-blue-400">
                <MapPin size={24} />
              </div>
              <h4 className="text-sm font-semibold text-white">No problems reported yet</h4>
              <p className="text-xs text-white/50 max-w-sm mx-auto mt-1 mb-4">
                Notice a broken road, water shortage, or waste pileup in your area? Report it to get university students building solutions.
              </p>
              <Link to="/challenges/new" className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5">
                <Plus size={14} /> Report First Problem
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {challenges.map((c) => {
                const id = c.id || c._id;
                const status = (c.status || "published").toLowerCase();
                const isPublished = status === "published" || status === "in_progress";

                return (
                  <div
                    key={id}
                    onClick={() => navigate(`/challenges/${id}`)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition cursor-pointer group gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge text-[11px] bg-white/10 text-white/70">
                          {c.category || "Civic Issue"}
                        </span>
                        {c.location && (
                          <span className="text-[11px] text-white/40 flex items-center gap-1">
                            <MapPin size={11} /> {c.location}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary-300 transition mt-1 truncate">
                        {c.title}
                      </h4>
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-1">
                        {c.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span
                        className={`badge text-xs capitalize ${
                          isPublished
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : status === "resolved"
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {status}
                      </span>
                      <ArrowRight size={16} className="text-white/30 group-hover:text-primary-400 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Col: Quick Actions & How It Works */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <div className="glass p-6">
            <h3 className="text-base font-semibold text-white mb-4">Citizen Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to="/challenges/new"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 text-primary-300 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary-500/20 flex items-center justify-center shrink-0">
                  <Plus size={18} className="text-primary-400 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Report New Issue</p>
                  <p className="text-[11px] text-white/50">Submit description, photos & location</p>
                </div>
              </Link>

              <Link
                to="/my-challenges"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Layers size={18} className="text-white/70 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">My Reported Issues</p>
                  <p className="text-[11px] text-white/50">Manage & track verification status</p>
                </div>
              </Link>

              <Link
                to="/challenges"
                className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white transition group"
              >
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <Compass size={18} className="text-white/70 group-hover:scale-110 transition" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Community Catalog</p>
                  <p className="text-[11px] text-white/50">Explore issues raised by other citizens</p>
                </div>
              </Link>
            </div>
          </div>

          {/* 3-Step Lifecycle Info */}
          <div className="glass p-6 bg-gradient-to-b from-dark-800 to-dark-800/80">
            <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-3">
              How JanSetu Solves Issues
            </h4>
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-white/60">
                  <strong className="text-white">You Report:</strong> Detail civic problems with location & supporting photos.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-white/60">
                  <strong className="text-white">Students & Labs Solve:</strong> University teams build multidisciplinary technology proposals.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-white/60">
                  <strong className="text-white">Industry Powers:</strong> Corporate partners fund grants and mentor teams to deployment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Common Civic Domain Categories */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">Browse Civic Problem Categories</h3>
            <p className="text-xs text-white/50">Explore challenges by impact domain in your region</p>
          </div>
          <Link to="/challenges" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
            Explore All Categories →
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORY_TILES.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.label}
                to={`/challenges?category=${encodeURIComponent(cat.key)}`}
                className={`p-3.5 rounded-xl ${cat.bg} border ${cat.border} hover:scale-[1.02] transition-all flex flex-col items-center text-center group`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-2">
                  <Icon className={`${cat.color} group-hover:scale-110 transition`} size={20} />
                </div>
                <span className="text-xs font-semibold text-white group-hover:text-primary-300 transition line-clamp-2">
                  {cat.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
