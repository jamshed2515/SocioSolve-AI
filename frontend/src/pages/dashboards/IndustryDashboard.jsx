import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import {
  Briefcase, HandshakeIcon, DollarSign, Star, ArrowRight, UserCheck,
  Plus, CheckCircle2, XCircle, Clock, Users, Gift, ToggleLeft, ToggleRight, MessageSquare
} from "lucide-react";
import toast from "react-hot-toast";
import partnershipService from "../../services/partnershipService";
import CreateOpportunityModal from "../../components/partnerships/CreateOpportunityModal";

const fallbackMentees = [
  { name: "Ali Hassan",   project: "Smart Agriculture IoT",    progress: 72, progressCls: "bg-emerald-500" },
  { name: "Sara Malik",   project: "Healthcare Data Platform", progress: 55, progressCls: "bg-cyan-500" },
  { name: "Usman Sheikh", project: "EdTech for Rural Schools", progress: 88, progressCls: "bg-primary-500" },
];

export default function IndustryDashboard() {
  const [opportunities, setOpportunities] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("opportunities"); // "opportunities" | "applications" | "mentees"
  const [processingId, setProcessingId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oppRes, appRes] = await Promise.all([
        partnershipService.getMyOpportunities(),
        partnershipService.getMyIncomingApplications(),
      ]);
      setOpportunities(oppRes.data?.opportunities || []);
      setApplications(appRes.data?.applications || []);
    } catch (err) {
      toast.error("Failed to load partnership data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStatus = async (opportunity) => {
    const newStatus = opportunity.status === "Active" ? "Closed" : "Active";
    try {
      await partnershipService.updateOpportunityStatus(opportunity.id, newStatus);
      toast.success(`Opportunity marked as ${newStatus}.`);
      setOpportunities((prev) =>
        prev.map((o) => (o.id === opportunity.id ? { ...o, status: newStatus } : o))
      );
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update status.");
    }
  };

  const handleApplicationDecision = async (applicationId, status) => {
    setProcessingId(applicationId);
    try {
      const res = await partnershipService.updateApplicationStatus(applicationId, status);
      toast.success(`Application ${status.toLowerCase()}!`);
      // Update local applications state
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? res.data : a))
      );
      // Refresh opportunities to get updated accepted counts
      const oppRes = await partnershipService.getMyOpportunities();
      setOpportunities(oppRes.data?.opportunities || []);
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Failed to ${status.toLowerCase()} application.`);
    } finally {
      setProcessingId(null);
    }
  };

  // Compute live metrics
  const totalAccepted = opportunities.reduce((acc, curr) => acc + (curr.acceptedTeamsCount || 0), 0);
  const pendingApps = applications.filter((a) => a.status === "Pending").length;

  const dynamicStats = [
    { label: "My Opportunities", value: opportunities.length.toString(), icon: Briefcase, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Accepted Teams", value: totalAccepted.toString(), icon: UserCheck, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Pending Applications", value: pendingApps.toString(), icon: HandshakeIcon, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Partner Rating", value: "4.8★", icon: Star, color: "text-primary-400", bg: "bg-primary-500/10" },
  ];

  return (
    <DashboardLayout title="Industry Dashboard">
      {/* ── Welcome Banner ────────────────────────────────────────── */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Briefcase size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Industry Partner Hub 🏢</h2>
              <p className="text-white/50 text-sm">Offer mentorship, fund student challenges & evaluate team applications.</p>
            </div>
          </div>
          <button
            id="industry-offer-btn"
            onClick={() => setModalOpen(true)}
            className="btn-primary text-sm flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500"
          >
            <Plus size={16} /> Post Opportunity
          </button>
        </div>
      </div>

      {/* ── Stats Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {dynamicStats.map(({ label, value, icon: Icon, color, bg }) => (
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
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab("opportunities")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "opportunities"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <Briefcase size={16} /> My Opportunities ({opportunities.length})
        </button>

        <button
          onClick={() => setActiveTab("applications")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "applications"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <HandshakeIcon size={16} /> Incoming Applications ({applications.length})
          {pendingApps > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-dark-900 text-xs font-bold flex items-center justify-center">
              {pendingApps}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("mentees")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === "mentees"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "text-white/60 hover:text-white hover:bg-white/5"
          }`}
        >
          <UserCheck size={16} /> Active Mentees
        </button>
      </div>

      {/* ── Tab 1: My Opportunities ──────────────────────────────── */}
      {activeTab === "opportunities" && (
        <div className="space-y-4">
          {loading ? (
            <div className="glass p-12 text-center text-white/40">Loading opportunities...</div>
          ) : opportunities.length === 0 ? (
            <div className="glass p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-white/30">
                <Briefcase size={24} />
              </div>
              <p className="text-white font-medium">No opportunities posted yet</p>
              <p className="text-xs text-white/40 max-w-sm mx-auto">
                Create a mentorship, grant, dataset or internship offer to start collaborating with student teams.
              </p>
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-500 inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Create First Opportunity
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {opportunities.map((opp) => (
                <div key={opp.id} className="glass p-5 flex flex-col justify-between border-white/5 hover:border-emerald-500/30 transition">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="badge text-[10px] bg-emerald-500/20 text-emerald-300 mb-1.5">
                          {opp.type}
                        </span>
                        <h3 className="text-base font-semibold text-white">{opp.title}</h3>
                      </div>
                      <span
                        className={`badge text-[10px] ${
                          opp.status === "Active"
                            ? "bg-green-500/20 text-green-300 border border-green-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/30"
                        }`}
                      >
                        {opp.status}
                      </span>
                    </div>

                    <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">
                      {opp.description}
                    </p>

                    {/* Resources */}
                    {opp.resourcesOffered?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {opp.resourcesOffered.map((res, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-white/70 text-[11px] flex items-center gap-1">
                            <Gift size={10} className="text-emerald-400" /> {res}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Categories */}
                    <div className="flex flex-wrap gap-1">
                      {opp.targetCategories?.map((cat, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-300">
                          #{cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer & Controls */}
                  <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-white/60">
                      <Users size={14} className="text-cyan-400" />
                      <span>
                        <strong className="text-white">{opp.acceptedTeamsCount || 0}</strong> / {opp.maxTeams} Teams Accepted
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(opp)}
                      className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1 text-white/70 hover:text-white"
                      title="Click to toggle opportunity between Active and Closed"
                    >
                      {opp.status === "Active" ? (
                        <>
                          <ToggleRight size={16} className="text-emerald-400" /> Close Offer
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={16} className="text-white/40" /> Re-open
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Incoming Applications ─────────────────────────── */}
      {activeTab === "applications" && (
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Incoming Student Applications</h3>
            <span className="text-xs text-white/40">Review pitches and make partnership decisions</span>
          </div>

          {applications.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-sm">
              No applications received yet. When student teams apply to your opportunities, they will appear here.
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{app.teamName}</span>
                        <span className="text-xs text-white/40">• Lead: {app.applicantName} ({app.applicantEmail})</span>
                      </div>
                      <p className="text-xs text-emerald-400 mt-0.5">Applied for: {app.partnershipTitle}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`badge text-[11px] ${
                          app.status === "Accepted"
                            ? "bg-green-500/20 text-green-300"
                            : app.status === "Rejected"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="p-3 rounded-lg bg-dark-700/60 border border-white/5 text-xs text-white/80 leading-relaxed">
                    <p className="font-semibold text-white/40 text-[10px] uppercase tracking-wider mb-1">Team Pitch</p>
                    {app.message}
                  </div>

                  {/* Action Buttons for Pending or Status Changes */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {app.status !== "Accepted" && (
                      <button
                        onClick={() => handleApplicationDecision(app.id, "Accepted")}
                        disabled={processingId === app.id}
                        className="btn-primary text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} /> Accept Team
                      </button>
                    )}

                    {app.status !== "Rejected" && (
                      <button
                        onClick={() => handleApplicationDecision(app.id, "Rejected")}
                        disabled={processingId === app.id}
                        className="btn-ghost text-xs px-3 py-1.5 hover:bg-red-500/20 hover:text-red-300 flex items-center gap-1.5"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Active Mentees (Preserved) ──────────────────────── */}
      {activeTab === "mentees" && (
        <div className="glass p-6">
          <h3 className="text-base font-semibold text-white mb-4">Active Mentees & Project Milestones</h3>
          <div className="space-y-4">
            {fallbackMentees.map((m, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 hover:bg-white/8 transition">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{m.name}</p>
                    <p className="text-xs text-white/40">{m.project}</p>
                  </div>
                  <span className="text-sm font-bold text-white">{m.progress}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${m.progressCls} rounded-full transition-all`} style={{ width: `${m.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create Opportunity Modal ──────────────────────────────── */}
      <CreateOpportunityModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => fetchData()}
      />
    </DashboardLayout>
  );
}
