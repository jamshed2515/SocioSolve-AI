import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Unauthorized() {
  const { user, ROLE_DASHBOARD } = useAuth();
  const dashboardLink = user?.role && ROLE_DASHBOARD?.[user.role] ? ROLE_DASHBOARD[user.role] : "/login";

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center animate-slide-up">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-400 mb-6 glow">
          <ShieldAlert size={40} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-white/50 text-sm mb-8 leading-relaxed">
          You do not have the required permissions or role to access this area.
          {user?.role && (
            <span className="block mt-2 text-xs text-primary-400 font-medium">
              Signed in as <span className="capitalize font-semibold">{user.role}</span>
            </span>
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to={dashboardLink}
            className="btn-primary text-sm flex items-center justify-center gap-2"
          >
            <Home size={16} /> Return to Dashboard
          </Link>
          <Link
            to="/login"
            className="btn-ghost text-sm flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} /> Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

