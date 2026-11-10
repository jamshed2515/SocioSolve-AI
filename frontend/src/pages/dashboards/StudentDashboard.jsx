import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import {
  GraduationCap, BookOpen, Users, Trophy, Lightbulb, ArrowRight,
  Briefcase, HandshakeIcon, Gift, Building2, Send, Clock, CheckCircle2, XCircle, Filter
} from "lucide-react";
import toast from "react-hot-toast";
import partnershipService from "../../services/partnershipService";
import ApplyOpportunityModal from "../../components/partnerships/ApplyOpportunityModal";

const fallbackChallenges = [
  { title: "AI for Clean Water Access",          deadline: "Nov 20, 2026", difficulty: "Medium", badgeCls: "bg-amber-500/20 text-amber-300" },
  { title: "Smart Traffic Management System",    deadline: "Dec 1, 2026",  difficulty: "Hard",   badgeCls: "bg-red-500/20 text-red-300" },
  { title: "Rural Education Tech Solution",      deadline: "Nov 25, 2026", difficulty: "Easy",   badgeCls: "bg-green-500/20 text-green-300" },
];

const OPPORTUNITY_TYPES = ["All", "Mentorship", "Funding", "Dataset", "Internship"];

export default function StudentDashboard() {
  const [opportunities, setOpportunities] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("challenges"); // "challenges" | "opportunities" | "applications"
  const [selectedType, setSelectedType] = useState("All");
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, appRes] = await Promise.all([
        partnershipService.getOpportunities({ status: "Active" }),
        partnershipService.getMyApplications(),
      ]);
      setOpportunities(oppRes.data?.opportunities || []);
      setMyApplications(appRes.data?.applications || []);
    } catch (err) {
      // Don't interrupt flow if backend is starting
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenApplyModal = (opportunity) => {
    // Check if already applied
    const alreadyApplied = myApplications.some((a) => a.partnershipId === opportunity.id);
    if (alreadyApplied) {
      return toast.error("Your team has already applied to this opportunity.");
    }
    setSelectedOpp(opportunity);
    setApplyModalOpen(true);
  };

  const filteredOpportunities = opportunities.filter((o) => {
    if (selectedType === "All") return true;
    return o.type === selectedType;
  });

  const stats = [
    { label: "Active Challenges",   value: "3",                           icon: Lightbulb,     color: "text-violet-400",  bg: "bg-violet-500/10" },
    { label: "Industry Offers",     value: opportunities.length.toString(), icon: Briefcase,     color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Applications Sent",   value: myApplications.length.toString(),icon: HandshakeIcon, color: "text-cyan-400",    bg: "bg-cyan-500/10" },
    { label: "Points Earned",       value: "340",                         icon: Trophy,        color: "text-amber-400",   bg: "bg-amber-500/10" },
  ];

  return (
    <DashboardLayout title="Student Dashboard">
      {/* ── Welcome Banner ────────────────────────────────────────── */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400">
              <GraduationCap size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Student Hub 🎓</h2>
              <p className="text-white/50 text-sm">Join challenges, apply for industry mentorship, and deliver societal solutions.</p>
            </div>
          </div>
          <button
            id="student-browse-btn"
            onClick={() => setActiveTab("opportunities")}
            className="btn-primary text-sm flex items-center gap-2 bg-violet-600 hover:bg-violet-500"
          >
            Explore Opportunities <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={color} size={20} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/50">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Section Navigation Tabs ──────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab("challenges")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "challenges"
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Lightbulb size={16} /> Active Challenges
        </button>

        <button
          onClick={() => setActiveTab("opportunities")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "opportunities"
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Briefcase size={16} /> Industry Opportunities ({opportunities.length})
        </button>

        <button
          onClick={() => setActiveTab("applications")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "applications"
              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Send size={16} /> My Applications ({myApplications.length})
        </button>
      </div>

      {/* ── Tab 1: Active Challenges (Preserved) ───────────────────── */}
      {activeTab === "challenges" && (
        <div className="glass p-6">
          <h3 className="text-base font-semibold text-white mb-4">Active Challenges</h3>
          <div className="space-y-3">
            {fallbackChallenges.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/8 transition cursor-pointer group">
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-primary-400 transition">{c.title}</p>
                  <p className="text-xs text-white/40 mt-0.5">Deadline: {c.deadline}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${c.badgeCls}`}>{c.difficulty}</span>
                  <ArrowRight size={16} className="text-white/30 group-hover:text-primary-400 transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 2: Explore Industry Opportunities ─────────────────── */}
      {activeTab === "opportunities" && (
        <div className="space-y-4">
          {/* Type Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-white/40 flex items-center gap-1 mr-1">
              <Filter size={13} /> Filter:
            </span>
            {OPPORTUNITY_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                  selectedType === t
                    ? "bg-violet-500 text-white border-violet-400"
                    : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {filteredOpportunities.length === 0 ? (
            <div className="glass p-12 text-center text-white/40">
              No opportunities matching this filter at this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOpportunities.map((opp) => {
                const isApplied = myApplications.some((a) => a.partnershipId === opp.id);
                const isFull = (opp.acceptedTeamsCount || 0) >= opp.maxTeams;

                return (
                  <div key={opp.id} className="glass p-5 flex flex-col justify-between border-white/5 hover:border-violet-500/30 transition">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="badge text-[10px] bg-emerald-500/20 text-emerald-300 mb-1.5">
                            {opp.type}
                          </span>
                          <h3 className="text-base font-semibold text-white">{opp.title}</h3>
                          <p className="text-xs text-white/50 flex items-center gap-1.5 mt-0.5">
                            <Building2 size={12} className="text-primary-400" />
                            {opp.organizationName}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-white/70 line-clamp-3 leading-relaxed">
                        {opp.description}
                      </p>

                      {/* Resources Offered */}
                      {opp.resourcesOffered?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {opp.resourcesOffered.map((res, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-white/70 text-[11px] flex items-center gap-1">
                              <Gift size={11} className="text-emerald-400" /> {res}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Categories */}
                      <div className="flex flex-wrap gap-1">
                        {opp.targetCategories?.map((cat, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300">
                            #{cat}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-white/50">
                        Quota: <strong className="text-white">{opp.acceptedTeamsCount || 0}</strong>/{opp.maxTeams} Teams
                      </span>

                      {isApplied ? (
                        <span className="badge text-xs bg-amber-500/20 text-amber-300 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Applied
                        </span>
                      ) : isFull ? (
                        <span className="badge text-xs bg-white/10 text-white/40">Quota Filled</span>
                      ) : (
                        <button
                          onClick={() => handleOpenApplyModal(opp)}
                          className="btn-primary text-xs px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 flex items-center gap-1.5"
                        >
                          <Send size={13} /> Apply as Team
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: My Applications ─────────────────────────────────── */}
      {activeTab === "applications" && (
        <div className="glass p-6">
          <h3 className="text-base font-semibold text-white mb-4">My Submitted Applications</h3>

          {myApplications.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-sm">
              You haven&apos;t applied to any industry partnership opportunities yet. Explore the available offers and apply with your team!
            </div>
          ) : (
            <div className="space-y-3">
              {myApplications.map((app) => (
                <div key={app.id} className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{app.partnershipTitle}</h4>
                      <p className="text-xs text-white/50">Applied as: <strong className="text-primary-300">{app.teamName}</strong></p>
                    </div>

                    <span
                      className={`badge text-xs self-start sm:self-auto ${
                        app.status === "Accepted"
                          ? "bg-green-500/20 text-green-300 border border-green-500/30"
                          : app.status === "Rejected"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>

                  <p className="text-xs text-white/70 bg-dark-700/50 p-2.5 rounded-lg border border-white/5">
                    <span className="text-white/40 font-medium block text-[10px] uppercase mb-0.5">Your Pitch</span>
                    {app.message}
                  </p>

                  {app.feedback && (
                    <p className="text-xs text-amber-300/90 italic">
                      Partner Feedback: {app.feedback}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Apply Opportunity Modal ───────────────────────────────── */}
      <ApplyOpportunityModal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        opportunity={selectedOpp}
        onApplied={() => fetchData()}
      />
    </DashboardLayout>
  );
}
