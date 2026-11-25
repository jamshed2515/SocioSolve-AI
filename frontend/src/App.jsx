import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

// Public marketing pages
import Landing from "./pages/public/Landing";
import About   from "./pages/public/About";
import Contact from "./pages/public/Contact";

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

// Module 4 – Solution Proposals & Evaluation
import ProposalDashboard   from "./pages/proposals/ProposalDashboard";
import MyProposals         from "./pages/proposals/MyProposals";
import ProposalFormPage    from "./pages/proposals/ProposalFormPage";
import ProposalDetailsPage from "./pages/proposals/ProposalDetailsPage";
import ReviewQueuePage     from "./pages/proposals/ReviewQueuePage";

// Route guards
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute      from "./routes/RoleRoute";

// Complete Profile (Google sign-in users)
import CompleteProfile from "./pages/auth/CompleteProfile";

// 403 page
import Unauthorized from "./pages/Unauthorized";

// Module 3 – Team Formation & Collaboration
import TeamCollaborationLayout from "./modules/team-collaboration/components/TeamCollaborationLayout";
import TeamDashboard           from "./modules/team-collaboration/pages/TeamDashboard";
import MyTeams                 from "./modules/team-collaboration/pages/MyTeams";
import CreateTeam              from "./modules/team-collaboration/pages/CreateTeam";
import TeamDetails             from "./modules/team-collaboration/pages/TeamDetails";
import ExploreTeams            from "./modules/team-collaboration/pages/ExploreTeams";
import TeamInvitations         from "./modules/team-collaboration/pages/TeamInvitations";
import TeamDiscussion          from "./modules/team-collaboration/pages/TeamDiscussion";
import TeamTasks               from "./modules/team-collaboration/pages/TeamTasks";
import TeamMeetings            from "./modules/team-collaboration/pages/TeamMeetings";

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
          <Route path="/"                 element={<Landing />} />
          <Route path="/about"            element={<About />} />
          <Route path="/contact"          element={<Contact />} />
          <Route path="/login"            element={<Login />} />
          <Route path="/register"         element={<Register />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />
          <Route path="/unauthorized"     element={<Unauthorized />} />

          {/* ── Complete Profile (Google sign-in, no backend profile yet) ── */}
          <Route path="/complete-profile" element={
            <ProtectedRoute skipProfileCheck>
              <CompleteProfile />
            </ProtectedRoute>
          } />

          {/* ── Protected: Profile (any role) ─────────────── */}
          <Route path="/profile" element={
            <ProtectedRoute><MyProfile /></ProtectedRoute>
          } />
          <Route path="/profile/edit" element={
            <ProtectedRoute><EditProfile /></ProtectedRoute>
          } />

          {/* ── Module 4: Solution Proposals & Evaluation ─── */}
          <Route path="/proposals" element={
            <ProtectedRoute><ProposalDashboard /></ProtectedRoute>
          } />
          <Route path="/proposals/my" element={
            <ProtectedRoute><MyProposals /></ProtectedRoute>
          } />
          <Route path="/proposals/new" element={
            <ProtectedRoute><ProposalFormPage /></ProtectedRoute>
          } />
          <Route path="/proposals/review-queue" element={
            <ProtectedRoute><ReviewQueuePage /></ProtectedRoute>
          } />
          <Route path="/proposals/:id" element={
            <ProtectedRoute><ProposalDetailsPage /></ProtectedRoute>
          } />
          <Route path="/proposals/:id/edit" element={
            <ProtectedRoute><ProposalFormPage /></ProtectedRoute>
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

          {/* ── Module 3: Team Formation & Collaboration ───── */}
          <Route path="/teams" element={<TeamCollaborationLayout />}>
            <Route index element={<TeamDashboard />} />
            <Route path="my-teams"    element={<MyTeams />} />
            <Route path="create"      element={<CreateTeam />} />
            <Route path="explore"     element={<ExploreTeams />} />
            <Route path="invitations" element={<TeamInvitations />} />
            <Route path="discussions" element={<TeamDiscussion />} />
            <Route path="tasks"       element={<TeamTasks />} />
            <Route path="meetings"    element={<TeamMeetings />} />
            <Route path=":id"         element={<TeamDetails />} />
          </Route>

          {/* ── 404 fallback ───────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
