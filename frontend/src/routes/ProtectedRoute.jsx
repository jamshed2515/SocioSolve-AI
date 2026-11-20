import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SyncErrorScreen() {
  const { syncError, retrySync, logout } = useAuth();
  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="glass p-8 text-center max-w-md">
        <h2 className="text-xl font-semibold text-white mb-2">Couldn&apos;t load your profile</h2>
        <p className="text-white/50 text-sm mb-6">{syncError || "Please try again."}</p>
        <div className="flex gap-3">
          <button onClick={logout} className="btn-ghost flex-1">Sign out</button>
          <button onClick={() => retrySync().catch(() => {})} className="btn-primary flex-1">Retry</button>
        </div>
      </div>
    </div>
  );
}

/** Requires a Firebase session AND a synced backend profile.
 *  Pass `skipProfileCheck` on routes meant for users who don't yet have a profile
 *  (e.g. /complete-profile) to avoid an infinite redirect loop. */
export default function ProtectedRoute({ children, skipProfileCheck = false }) {
  const { firebaseUser, user, loading, needsProfile, syncError } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!firebaseUser) return <Navigate to="/login" state={{ from: location }} replace />;

  // If the route itself is the profile-completion page, skip further checks
  if (skipProfileCheck) return children;

  if (needsProfile) return <Navigate to="/complete-profile" replace />;
  if (syncError) return <SyncErrorScreen />;
  if (!user) return <SyncErrorScreen />;
  if (user.isActive === false) return <Navigate to="/unauthorized" replace />;

  return children;
}

