import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import { MapPin, AlertCircle, Clock, CheckCircle2, Plus, TrendingUp } from "lucide-react";

const stats = [
  { label: "Problems Reported",  value: "12",  icon: AlertCircle,  color: "text-blue-400",    bg: "bg-blue-500/10" },
  { label: "Under Review",       value: "5",   icon: Clock,        color: "text-amber-400",   bg: "bg-amber-500/10" },
  { label: "Resolved",           value: "4",   icon: CheckCircle2, color: "text-green-400",   bg: "bg-green-500/10" },
  { label: "Impact Score",       value: "78",  icon: TrendingUp,   color: "text-primary-400", bg: "bg-primary-500/10" },
];

const recent = [
  { title: "Broken street light on Main Blvd",   status: "Under Review", date: "2 days ago",  statusCls: "bg-amber-500/20 text-amber-300" },
  { title: "Flooded drain near school",           status: "Resolved",     date: "1 week ago",  statusCls: "bg-green-500/20 text-green-300" },
  { title: "Illegal dumping at park",             status: "Reported",     date: "3 days ago",  statusCls: "bg-blue-500/20 text-blue-300" },
];

export default function CitizenDashboard() {
  const navigate = useNavigate();

  return (
    <DashboardLayout title="Citizen Dashboard">
      {/* Welcome banner */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <MapPin className="text-blue-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Welcome, Citizen! 🏘️</h2>
            <p className="text-white/50 text-sm">Report community problems and track their resolution.</p>
          </div>
          <Link
            to="/challenges/new"
            id="citizen-report-btn"
            className="ml-auto btn-primary text-sm inline-flex items-center gap-1.5"
          >
            <Plus size={16} /> Report Problem
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            onClick={() => {
              if (label === "Problems Reported" || label === "Under Review" || label === "Resolved") {
                navigate("/my-challenges");
              }
            }}
            className="stat-card cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={color} size={20} />
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/50">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent reports */}
      <div className="glass p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Recent Reports</h3>
          <Link to="/my-challenges" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
            View All Reports →
          </Link>
        </div>
        <div className="space-y-3">
          {recent.map((r, i) => (
            <div
              key={i}
              onClick={() => navigate("/my-challenges")}
              className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/8 transition cursor-pointer"
            >
              <div>
                <p className="text-sm font-medium text-white">{r.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{r.date}</p>
              </div>
              <span className={`badge ${r.statusCls}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
