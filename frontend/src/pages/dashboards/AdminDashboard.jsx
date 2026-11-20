import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import authService, { firebaseErrorMessage } from "../../services/authService";
import toast from "react-hot-toast";
import {
  Shield, Users, AlertTriangle, CheckCircle2, Ban,
  Check, X, RefreshCw, Building2,
} from "lucide-react";

const ROLE_DISTRIBUTION = [
  { role: "Citizens",  count: 540, pct: 42, color: "bg-blue-500" },
  { role: "Students",  count: 410, pct: 32, color: "bg-violet-500" },
  { role: "University",count: 180, pct: 14, color: "bg-amber-500" },
  { role: "Industry",  count: 154, pct: 12, color: "bg-emerald-500" },
];

export default function AdminDashboard() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);
  const [pendingError, setPendingError] = useState("");
  const [actionId, setActionId] = useState(null);

  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    setPendingError("");
    try {
      const { data } = await authService.getPendingUsers();
      setPendingUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setPendingError(firebaseErrorMessage(err));
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    const cancelled = { current: false };
    authService
      .getPendingUsers()
      .then(({ data }) => {
        if (!cancelled.current) {
          setPendingUsers(Array.isArray(data) ? data : []);
          setPendingError("");
        }
      })
      .catch((err) => {
        if (!cancelled.current) setPendingError(firebaseErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled.current) setLoadingPending(false);
      });
    return () => {
      cancelled.current = true;
    };
  }, []);

  const handleDecision = async (userId, approve, userName) => {
    setActionId(userId);
    try {
      await authService.setUserApproval(userId, approve);
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success(
        approve
          ? `Approved ${userName || "account"}!`
          : `Rejected ${userName || "account"}.`
      );
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const stats = [
    { label: "Total Users",       value: "1,284",                   icon: Users,         color: "text-primary-400", bg: "bg-primary-500/10" },
    { label: "Pending Approvals", value: String(pendingUsers.length), icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/10" },
    { label: "Verified Accounts", value: "1,061",                   icon: CheckCircle2,  color: "text-green-400",   bg: "bg-green-500/10" },
    { label: "Suspended",         value: "8",                       icon: Ban,           color: "text-red-400",     bg: "bg-red-500/10" },
  ];

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
            <p className="text-white/50 text-sm">Monitor the platform, approve organizations & manage users.</p>
          </div>
          <button
            id="admin-refresh-btn"
            type="button"
            onClick={fetchPending}
            disabled={loadingPending}
            className="ml-auto btn-primary text-sm"
          >
            <RefreshCw size={16} className={loadingPending ? "animate-spin" : ""} /> Refresh
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

        {/* Live Pending Organization Approvals */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">Pending Organization Approvals</h3>
              <p className="text-xs text-white/40 mt-0.5">University & Industry accounts awaiting verification</p>
            </div>
            <span className="badge bg-amber-500/20 text-amber-300">
              {pendingUsers.length} pending
            </span>
          </div>

          {loadingPending ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingError ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex items-center justify-between gap-3">
              <span>{pendingError}</span>
              <button type="button" onClick={fetchPending} className="btn-ghost text-xs px-3 py-1.5">
                Retry
              </button>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-10 text-white/40 text-sm">
              <CheckCircle2 className="mx-auto mb-2 text-emerald-400/70" size={28} />
              No pending organization approvals right now.
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {pendingUsers.map((u) => {
                const busy = actionId === u.id;
                return (
                  <div
                    key={u.id}
                    data-pending-user-id={u.id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-300 shrink-0">
                        <Building2 size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.name}</p>
                        <p className="text-xs text-white/50 truncate">{u.email}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="badge bg-amber-500/20 text-amber-300 capitalize text-[10px]">
                            {u.role}
                          </span>
                          {u.organization?.name && (
                            <span className="text-xs text-white/60 truncate">
                              · {u.organization.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDecision(u.id, true, u.name)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1 transition disabled:opacity-50"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDecision(u.id, false, u.name)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-medium flex items-center gap-1 transition disabled:opacity-50"
                      >
                        <X size={14} /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
