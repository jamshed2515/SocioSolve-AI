import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FullPageSpinner } from "./ProtectedRoute";

/**
 * UI-level role gate. The role comes from the backend profile (never from the
 * registration form); the backend enforces the same rule on every API call.
 * Usage: <RoleRoute role="admin"><AdminDashboard /></RoleRoute>
 */
export default function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to="/unauthorized" replace />;

  return children;
}
