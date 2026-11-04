import DashboardLayout from "../../components/layouts/DashboardLayout";
import { Shield, Users, AlertTriangle, CheckCircle2, Ban, Settings, ArrowRight } from "lucide-react";

const stats = [
  { label: "Total Users",       value: "1,284", icon: Users,         color: "text-primary-400", bg: "bg-primary-500/10" },
  { label: "Pending Reviews",   value: "23",    icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/10" },
  { label: "Verified Accounts", value: "1,061", icon: CheckCircle2,  color: "text-green-400",   bg: "bg-green-500/10" },
  { label: "Suspended",         value: "8",     icon: Ban,           color: "text-red-400",     bg: "bg-red-500/10" },
];

const ROLE_DISTRIBUTION = [
  { role: "Citizens",  count: 540, pct: 42, color: "bg-blue-500" },
  { role: "Students",  count: 410, pct: 32, color: "bg-violet-500" },
  { role: "University",count: 180, pct: 14, color: "bg-amber-500" },
  { role: "Industry",  count: 154, pct: 12, color: "bg-emerald-500" },
];

const recentUsers = [
  { name: "Ahmad Raza",   role: "student",   date: "2 hrs ago",   status: "Active",    statusCls: "bg-green-500/20 text-green-300" },
  { name: "LUMS Karachi", role: "university",date: "5 hrs ago",   status: "Pending",   statusCls: "bg-amber-500/20 text-amber-300" },
  { name: "TechBridge",   role: "industry",  date: "1 day ago",   status: "Active",    statusCls: "bg-green-500/20 text-green-300" },
  { name: "Sana Ali",     role: "citizen",   date: "1 day ago",   status: "Suspended", statusCls: "bg-red-500/20 text-red-300" },
];

export default function AdminDashboard() {
  return (
    <DashboardLayout title="Admin Dashboard">
      {/* Welcome banner */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-rose-500/10 to-pink-500/10 border-rose-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center">
            <Shield className="text-rose-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Admin Control Panel 🛡️</h2>
            <p className="text-white/50 text-sm">Monitor the platform, manage users & system settings.</p>
          </div>
          <button id="admin-settings-btn" className="ml-auto btn-primary text-sm">
            <Settings size={16} /> Settings
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

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Role distribution */}
        <div className="glass p-6">
          <h3 className="text-base font-semibold text-white mb-4">User Distribution by Role</h3>
          <div className="space-y-4">
            {ROLE_DISTRIBUTION.map((r) => (
              <div key={r.role}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-white/70">{r.role}</span>
                  <span className="text-white font-medium">{r.count} <span className="text-white/40 font-normal">({r.pct}%)</span></span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent registrations */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Recent Registrations</h3>
            <button className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 transition">
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {recentUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-xs font-bold text-primary-400">
                    {u.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{u.name}</p>
                    <p className="text-xs text-white/40">{u.role} · {u.date}</p>
                  </div>
                </div>
                <span className={`badge ${u.statusCls}`}>{u.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
