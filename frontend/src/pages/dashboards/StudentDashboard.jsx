import DashboardLayout from "../../components/layouts/DashboardLayout";
import { GraduationCap, BookOpen, Users, Trophy, Lightbulb, ArrowRight } from "lucide-react";

const stats = [
  { label: "Active Challenges",  value: "3",   icon: Lightbulb, color: "text-violet-400",  bg: "bg-violet-500/10" },
  { label: "Team Projects",      value: "2",   icon: Users,     color: "text-primary-400", bg: "bg-primary-500/10" },
  { label: "Proposals Submitted",value: "7",   icon: BookOpen,  color: "text-cyan-400",    bg: "bg-cyan-500/10" },
  { label: "Points Earned",      value: "340", icon: Trophy,    color: "text-amber-400",   bg: "bg-amber-500/10" },
];

const challenges = [
  { title: "AI for Clean Water Access",          deadline: "Nov 20, 2026", difficulty: "Medium", badgeCls: "bg-amber-500/20 text-amber-300" },
  { title: "Smart Traffic Management System",    deadline: "Dec 1, 2026",  difficulty: "Hard",   badgeCls: "bg-red-500/20 text-red-300" },
  { title: "Rural Education Tech Solution",      deadline: "Nov 25, 2026", difficulty: "Easy",   badgeCls: "bg-green-500/20 text-green-300" },
];

export default function StudentDashboard() {
  return (
    <DashboardLayout title="Student Dashboard">
      {/* Welcome banner */}
      <div className="glass p-6 mb-6 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <GraduationCap className="text-violet-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Student Hub 🎓</h2>
            <p className="text-white/50 text-sm">Join challenges, build teams, submit solutions.</p>
          </div>
          <button id="student-browse-btn" className="ml-auto btn-primary text-sm">
            Browse Challenges <ArrowRight size={16} />
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

      {/* Active challenges */}
      <div className="glass p-6">
        <h3 className="text-base font-semibold text-white mb-4">Active Challenges</h3>
        <div className="space-y-3">
          {challenges.map((c, i) => (
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
    </DashboardLayout>
  );
}
