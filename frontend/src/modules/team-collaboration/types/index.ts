export type UserRole = "citizen" | "student" | "university" | "industry" | "admin";

export interface AuthUser {
  id?: string;
  name?: string;
  email?: string;
  role?: UserRole;
  profileImage?: string | null;
  skills?: string[];
  isVerified?: boolean;
}

export interface DashboardStatItem {
  id: string;
  label: string;
  value: number;
  changeText: string;
  iconName: "users" | "user-check" | "mail" | "list-checks" | "check-circle";
  accentColor: string;
  accentBg: string;
}

export interface RecentTeamItem {
  id: string;
  name: string;
  challengeTitle: string;
  district: string;
  role: "Team Lead" | "Core Member" | "Mentor" | "Contributor";
  memberCount: number;
  maxMembers: number;
  progressPercent: number;
  status: "Active" | "Recruiting" | "Review";
  lastUpdated: string;
}

export interface TeamActivityItem {
  id: string;
  actorName: string;
  actorInitials: string;
  action: string;
  target: string;
  teamName: string;
  timestamp: string;
  category: "task" | "discussion" | "member" | "milestone";
}

export interface UpcomingMeetingItem {
  id: string;
  title: string;
  teamName: string;
  dateLabel: string;
  timeLabel: string;
  mode: "Online Video" | "Campus Sync" | "Field Check-in";
  participantsCount: number;
}

export interface PendingTaskItem {
  id: string;
  title: string;
  teamName: string;
  dueLabel: string;
  priority: "High" | "Medium" | "Low";
  status: "In Progress" | "To Do" | "Blocked";
}

export interface HealthResponse {
  status: string;
}

export interface DatabaseReadiness {
  connected: boolean;
  database_name: string;
  message: string;
}

export interface ModuleStatusResponse {
  module: string;
  project: string;
  phase: string;
  status: "operational" | "degraded";
  auth_integration: string;
  database: DatabaseReadiness;
  planned_capabilities: string[];
  timestamp: string;
}

export interface BackendHealthState {
  loading: boolean;
  apiReachable: boolean;
  healthStatus: string | null;
  moduleStatus: ModuleStatusResponse | null;
  error: string | null;
  lastCheckedAt: string | null;
}

export type PreviewViewState = "ready" | "loading" | "empty" | "error";

