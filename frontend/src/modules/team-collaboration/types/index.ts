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

export type TeamStatus = "recruiting" | "full" | "active" | "completed";

export interface TeamMember {
  user_id: string;
  name?: string;
  email?: string;
  role: string;
  joined_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  challenge_id: string;
  challenge_title?: string;
  challenge_category?: string;
  leader_id: string;
  leader_name?: string;
  members: TeamMember[];
  member_count: number;
  max_members: number;
  status: TeamStatus;
  is_leader?: boolean;
  is_member?: boolean;
  user_request_status?: JoinRequestStatus | null;
  user_request_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type JoinRequestStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type InvitationStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface TeamInvitation {
  id: string;
  team_id: string;
  team_name?: string;
  team_status?: TeamStatus;
  challenge_title?: string;
  member_count?: number;
  max_members?: number;
  inviter_id: string;
  inviter_name?: string;
  inviter_email?: string;
  invitee_id: string;
  invitee_name?: string;
  invitee_email?: string;
  invitee_profile_image?: string | null;
  invitee_skills?: string[];
  message?: string | null;
  status: InvitationStatus;
  created_at: string;
  updated_at: string;
}

export interface InvitationListResponse {
  items: TeamInvitation[];
  total: number;
}

export interface TeamMemberDetail {
  user_id: string;
  name: string;
  email?: string;
  role: string;
  joined_at: string;
  skills?: string[];
  profile_image?: string | null;
  organization_or_university?: string | null;
}

export interface UserSearchCandidate {
  id: string;
  name: string;
  email: string;
  role: string;
  skills?: string[];
  profile_image?: string | null;
  organization_or_university?: string | null;
}

// ── Phase 5: Team Discussions & Comments ────────────────────────────────────
export type DiscussionCategory =
  | "General"
  | "Ideas"
  | "Technical"
  | "Resources"
  | "Announcements"
  | "Questions";

export interface TeamDiscussion {
  id: string;
  team_id: string;
  team_name?: string;
  author_id: string;
  author_name: string;
  author_email?: string;
  author_role: string;
  author_profile_image?: string | null;
  title: string;
  content: string;
  category: DiscussionCategory | string;
  is_pinned: boolean;
  is_locked: boolean;
  comment_count: number;
  is_author: boolean;
  is_leader: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_pin: boolean;
  can_lock: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiscussionListResponse {
  items: TeamDiscussion[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DiscussionComment {
  id: string;
  discussion_id: string;
  team_id: string;
  author_id: string;
  author_name: string;
  author_email?: string;
  author_role: string;
  author_profile_image?: string | null;
  content: string;
  parent_comment_id?: string | null;
  replies_count: number;
  replies: DiscussionComment[];
  is_author: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommentListResponse {
  items: DiscussionComment[];
  total: number;
}

export interface JoinRequest {
  id: string;
  team_id: string;
  team_name?: string;
  team_status?: TeamStatus;
  challenge_title?: string;
  leader_id?: string;
  leader_name?: string;
  member_count?: number;
  max_members?: number;
  user_id: string;
  applicant_name?: string;
  applicant_email?: string;
  applicant_profile_image?: string | null;
  applicant_skills?: string[];
  applicant_role?: string;
  message?: string | null;
  status: JoinRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface JoinRequestListResponse {
  requests: JoinRequest[];
  total: number;
}

export interface CreateJoinRequestPayload {
  team_id: string;
  message?: string;
}

export interface JoinRequestDecisionPayload {
  decision: "accepted" | "rejected";
}

export interface TeamListResponse {
  teams: Team[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ChallengeOption {
  id: string;
  title: string;
  category?: string;
  description?: string;
  location?: string;
  status?: string;
}

export interface CreateTeamPayload {
  name: string;
  description: string;
  challenge_id: string;
  max_members: number;
}

export interface UpdateTeamPayload {
  name?: string;
  description?: string;
  max_members?: number;
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

// ── Phase 6: Team Tasks & Deliverables ─────────────────────────────────────────

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "todo" | "in_progress" | "review" | "completed";

export interface AssignedMemberInfo {
  id: string;
  name: string;
  email?: string | null;
  avatar?: string | null;
  role?: string | null;
}

export interface TaskPermissions {
  can_edit: boolean;
  can_delete: boolean;
  can_update_status: boolean;
  can_update_progress: boolean;
  can_reassign: boolean;
  is_leader: boolean;
  is_assigned: boolean;
}

export interface TeamTask {
  id: string;
  team_id: string;
  team_name?: string | null;
  title: string;
  description: string;
  created_by: string;
  creator_name?: string | null;
  creator_email?: string | null;
  assigned_to: string[];
  assigned_members: AssignedMemberInfo[];
  priority: TaskPriority;
  status: TaskStatus;
  start_date?: string | null;
  due_date?: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  is_overdue: boolean;
  permissions?: TaskPermissions;
}

export interface TaskListResponse {
  items: TeamTask[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigned_to?: string[];
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  assigned_to?: string[];
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
}

