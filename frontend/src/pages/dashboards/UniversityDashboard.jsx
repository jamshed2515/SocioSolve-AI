import DashboardLayout from "../../components/layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { Building2, Users, FlaskConical, Award, FileText, ArrowRight, Clock, XCircle } from "lucide-react";

const stats = [
  { label: "Active Students",    value: "248", icon: Users,       color: "text-amber-400",   bg: "bg-amber-500/10" },
  { label: "Research Projects",  value: "14",  icon: FlaskConical,color: "text-cyan-400",    bg: "bg-cyan-500/10" },
  { label: "Published Papers",   value: "32",  icon: FileText,    color: "text-green-400",   bg: "bg-green-500/10" },
  { label: "Awards Won",         value: "6",   icon: Award,       color: "text-primary-400", bg: "bg-primary-500/10" },
];

const projects = [
  { title: "NLP for Urdu Language Processing",   team: "12 students", status: "Active",   statusCls: "bg-green-500/20 text-green-300" },
  { title: "Blockchain for Land Records",         team: "8 students",  status: "Review",   statusCls: "bg-amber-500/20 text-amber-300" },
  { title: "Solar Microgrid Design",              team: "15 students", status: "Active",   statusCls: "bg-green-500/20 text-green-300" },
];

export default function UniversityDashboard() {
  const { user } = useAuth();
  const isPending = user?.approvalStatus === "pending";
  const isRejected = user?.approvalStatus === "rejected";

  return (
    <DashboardLayout title="University Dashboard">
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

      {/* Welcome banner */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Building2 className="text-amber-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">University Portal 🏛️</h2>
            <p className="text-white/50 text-sm">Manage institutional projects, students & research.</p>
          </div>
          <button id="uni-add-project-btn" className="ml-auto btn-primary text-sm">
            Add Project <ArrowRight size={16} />
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

      {/* Projects */}
      <div className="glass p-6">
        <h3 className="text-base font-semibold text-white mb-4">Institution Projects</h3>
        <div className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/8 transition">
              <div>
                <p className="text-sm font-medium text-white">{p.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{p.team}</p>
              </div>
              <span className={`badge ${p.statusCls}`}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
