import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FullPageSpinner } from "./ProtectedRoute";

/**
 * UI-level role gate. The role comes from the backend profile (never from the
 * registration form); the backend enforces the same rule on every API call.
 * Usage:
 *   <RoleRoute role="admin"><AdminDashboard /></RoleRoute>
 *   <RoleRoute roles={["university", "industry", "admin"]}><ReviewQueuePage /></RoleRoute>
 */
export default function RoleRoute({ role, roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  const allowedRoles = Array.isArray(roles) ? roles : role ? [role] : [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
