import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

// Auth pages
import Login          from "./pages/auth/Login";
import Register       from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword  from "./pages/auth/ResetPassword";

// Dashboards
import CitizenDashboard    from "./pages/dashboards/CitizenDashboard";
import StudentDashboard    from "./pages/dashboards/StudentDashboard";
import UniversityDashboard from "./pages/dashboards/UniversityDashboard";
import IndustryDashboard   from "./pages/dashboards/IndustryDashboard";
import AdminDashboard      from "./pages/dashboards/AdminDashboard";

// Profile
import MyProfile   from "./pages/profile/MyProfile";
import EditProfile from "./pages/profile/EditProfile";

// Route guards
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute      from "./routes/RoleRoute";

// 403 page
import Unauthorized from "./pages/Unauthorized";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1a1a35",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#00D4AA", secondary: "#1a1a35" } },
            error:   { iconTheme: { primary: "#f87171", secondary: "#1a1a35" } },
          }}
        />

        <Routes>
          {/* ── Public routes ──────────────────────────────── */}
          <Route path="/"                 element={<Navigate to="/login" replace />} />
          <Route path="/login"            element={<Login />} />
          <Route path="/register"         element={<Register />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />
          <Route path="/unauthorized"     element={<Unauthorized />} />

          {/* ── Protected: Profile (any role) ─────────────── */}
          <Route path="/profile" element={
            <ProtectedRoute><MyProfile /></ProtectedRoute>
          } />
          <Route path="/profile/edit" element={
            <ProtectedRoute><EditProfile /></ProtectedRoute>
          } />

          {/* ── Role-specific Dashboards ───────────────────── */}
          <Route path="/dashboard/citizen" element={
            <ProtectedRoute>
              <RoleRoute role="citizen"><CitizenDashboard /></RoleRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/student" element={
            <ProtectedRoute>
              <RoleRoute role="student"><StudentDashboard /></RoleRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/university" element={
            <ProtectedRoute>
              <RoleRoute role="university"><UniversityDashboard /></RoleRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/industry" element={
            <ProtectedRoute>
              <RoleRoute role="industry"><IndustryDashboard /></RoleRoute>
            </ProtectedRoute>
          } />
          <Route path="/dashboard/admin" element={
            <ProtectedRoute>
              <RoleRoute role="admin"><AdminDashboard /></RoleRoute>
            </ProtectedRoute>
          } />

          {/* ── 404 fallback ───────────────────────────────── */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
