import DashboardLayout from "../../components/layouts/DashboardLayout";
import { Briefcase, HandshakeIcon, DollarSign, Star, ArrowRight, UserCheck } from "lucide-react";

const stats = [
  { label: "Active Mentorships",  value: "9",    icon: UserCheck,     color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { label: "Partnerships",        value: "4",    icon: HandshakeIcon, color: "text-cyan-400",    bg: "bg-cyan-500/10" },
  { label: "Funded Projects",     value: "3",    icon: DollarSign,    color: "text-green-400",   bg: "bg-green-500/10" },
  { label: "Partner Rating",      value: "4.8★", icon: Star,          color: "text-amber-400",   bg: "bg-amber-500/10" },
];

const mentees = [
  { name: "Ali Hassan",    project: "Smart Agriculture IoT",    progress: 72, progressCls: "bg-emerald-500" },
  { name: "Sara Malik",    project: "Healthcare Data Platform", progress: 55, progressCls: "bg-cyan-500" },
  { name: "Usman Sheikh",  project: "EdTech for Rural Schools", progress: 88, progressCls: "bg-primary-500" },
];

export default function IndustryDashboard() {
  return (
    <DashboardLayout title="Industry Dashboard">
      {/* Welcome banner */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Briefcase className="text-emerald-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Industry Partner Hub 🏢</h2>
            <p className="text-white/50 text-sm">Mentor students, fund projects & build partnerships.</p>
          </div>
          <button id="industry-offer-btn" className="ml-auto btn-primary text-sm">
            Post Opportunity <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
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

      {/* Mentees */}
      <div className="glass p-6">
        <h3 className="text-base font-semibold text-white mb-4">Active Mentees</h3>
        <div className="space-y-4">
          {mentees.map((m, i) => (
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
    </DashboardLayout>
  );
}
