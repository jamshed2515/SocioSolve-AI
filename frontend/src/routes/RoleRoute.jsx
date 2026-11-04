import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Restricts access to users with a specific role.
 * Usage: <RoleRoute role="admin"><AdminDashboard /></RoleRoute>
 */
export default function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== role) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
