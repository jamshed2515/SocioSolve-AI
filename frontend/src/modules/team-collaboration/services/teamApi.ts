import axios from "axios";
import api, { API_BASE_URL, BACKEND_ORIGIN } from "../../../services/api";
import type {
  ChallengeOption,
  CommentListResponse,
  CreateJoinRequestPayload,
  CreateTaskPayload,
  CreateTeamPayload,
  DiscussionComment,
  DiscussionListResponse,
  HealthResponse,
  InvitationListResponse,
  JoinRequest,
  JoinRequestDecisionPayload,
  JoinRequestListResponse,
  ModuleStatusResponse,
  TaskPriority,
  TaskStatus,
  TaskListResponse,
  Team,
  TeamDiscussion,
  TeamInvitation,
  TeamListResponse,
  TeamMemberDetail,
  TeamTask,
  UpdateTaskPayload,
  UpdateTeamPayload,
  UserSearchCandidate,
} from "../types";

/**
 * Centralized API client for Module 3 (Team Formation & Collaboration).
 *
 * - Reuses the shared Axios instance (`src/services/api.js`) so JWT Bearer tokens,
 *   cookies, and automatic 401 token refresh from Module 1 work seamlessly.
 * - Uses `VITE_API_URL` configured via environment variables (no hardcoded prod URLs).
 */
export const teamApiConfig = {
  backendOrigin: BACKEND_ORIGIN,
  apiBaseUrl: API_BASE_URL,
  modulePrefix: "/teams",
} as const;

export const teamApi = {
  /**
   * Shared Axios instance authenticated via Module 1 JWT interceptors.
   */
  client: api,

  /**
   * Call existing root FastAPI health endpoint (`GET /health`).
   */
  async getHealth(): Promise<HealthResponse> {
    const response = await axios.get<HealthResponse>(`${BACKEND_ORIGIN}/health`, {
      timeout: 5000,
    });
    return response.data;
  },

  /**
   * Call Module 3 foundation status endpoint (`GET /api/teams/status`).
   */
  async getModuleStatus(): Promise<ModuleStatusResponse> {
    const response = await api.get<ModuleStatusResponse>(
      `${teamApiConfig.modulePrefix}/status`,
      { timeout: 5000 }
    );
    return response.data;
  },

  /**
   * Fetch published challenges eligible for team formation.
   */
  async getChallenges(): Promise<ChallengeOption[]> {
    try {
      const response = await api.get<ChallengeOption[]>(
        `${teamApiConfig.modulePrefix}/challenges`
      );
      return response.data;
    } catch {
      // Fallback to Module 4 published challenges if available
      try {
        const fallback = await api.get<{ challenges: ChallengeOption[] }>(
          "/proposals/challenges/published"
        );
        return fallback.data.challenges || [];
      } catch {
        return [];
      }
    }
  },

  /**
   * Create a new team associated with a societal challenge.
   * POST /api/teams
   */
  async createTeam(payload: CreateTeamPayload): Promise<Team> {
    const response = await api.post<Team>(`${teamApiConfig.modulePrefix}`, payload);
    return response.data;
  },

  /**
   * Get all teams where the authenticated user is Leader or Member.
   * GET /api/teams/my
   */
  async getMyTeams(page = 1, limit = 20): Promise<TeamListResponse> {
    const response = await api.get<TeamListResponse>(
      `${teamApiConfig.modulePrefix}/my`,
      { params: { page, limit } }
    );
    return response.data;
  },

  /**
   * Get all teams with optional search, challenge filtering, and status filtering.
   * GET /api/teams
   */
  async getAllTeams(params?: {
    page?: number;
    limit?: number;
    search?: string;
    challenge_id?: string;
    status?: string;
  }): Promise<TeamListResponse> {
    const response = await api.get<TeamListResponse>(
      `${teamApiConfig.modulePrefix}`,
      { params }
    );
    return response.data;
  },

  /**
   * Get details for a single team.
   * GET /api/teams/{team_id}
   */
  async getTeamById(teamId: string): Promise<Team> {
    const response = await api.get<Team>(
      `${teamApiConfig.modulePrefix}/${teamId}`
    );
    return response.data;
  },

  /**
   * Update team details (name, description, capacity). Leader only.
   * PUT /api/teams/{team_id}
   */
  async updateTeam(teamId: string, payload: UpdateTeamPayload): Promise<Team> {
    const response = await api.put<Team>(
      `${teamApiConfig.modulePrefix}/${teamId}`,
      payload
    );
    return response.data;
  },

  /**
   * Delete a team. Leader only.
   * DELETE /api/teams/{team_id}
   */
  async deleteTeam(teamId: string): Promise<{ message: string; team_id: string }> {
    const response = await api.delete<{ message: string; team_id: string }>(
      `${teamApiConfig.modulePrefix}/${teamId}`
    );
    return response.data;
  },

  /**
   * Submit a request to join a team.
   * POST /api/join-requests
   */
  async submitJoinRequest(payload: CreateJoinRequestPayload): Promise<JoinRequest> {
    const response = await api.post<JoinRequest>("/join-requests", payload);
    return response.data;
  },

  /**
   * Get all join requests submitted by the authenticated user.
   * GET /api/join-requests/my
   */
  async getMyJoinRequests(status?: string): Promise<JoinRequestListResponse> {
    const response = await api.get<JoinRequestListResponse>("/join-requests/my", {
      params: status && status !== "all" ? { status } : undefined,
    });
    return response.data;
  },

  /**
   * Get all join requests for a specific team (Leader only).
   * GET /api/teams/{team_id}/join-requests
   */
  async getTeamJoinRequests(teamId: string, status?: string): Promise<JoinRequestListResponse> {
    const response = await api.get<JoinRequestListResponse>(
      `${teamApiConfig.modulePrefix}/${teamId}/join-requests`,
      {
        params: status && status !== "all" ? { status } : undefined,
      }
    );
    return response.data;
  },

  /**
   * Leader approves or rejects a student's join request.
   * PUT /api/join-requests/{request_id}/decision
   */
  async decideJoinRequest(
    requestId: string,
    decision: "accepted" | "rejected"
  ): Promise<JoinRequest> {
    const response = await api.put<JoinRequest>(
      `/join-requests/${requestId}/decision`,
      { decision }
    );
    return response.data;
  },

  /**
   * Requester cancels their pending join request.
   * PUT /api/join-requests/{request_id}/cancel
   */
  async cancelJoinRequest(requestId: string): Promise<JoinRequest> {
    const response = await api.put<JoinRequest>(`/join-requests/${requestId}/cancel`);
    return response.data;
  },

  // ── PHASE 4: INVITATIONS & MEMBER MANAGEMENT ─────────────────────────────

  /**
   * Leader sends an invitation to a registered user.
   * POST /api/teams/{team_id}/invitations
   */
  async sendInvitation(
    teamId: string,
    payload: { invitee_id: string; message?: string }
  ): Promise<TeamInvitation> {
    const response = await api.post<TeamInvitation>(
      `${teamApiConfig.modulePrefix}/${teamId}/invitations`,
      payload
    );
    return response.data;
  },

  /**
   * Get invitations received by the current user.
   * GET /api/invitations/received
   */
  async getReceivedInvitations(status?: string): Promise<InvitationListResponse> {
    const response = await api.get<InvitationListResponse>("/invitations/received", {
      params: status && status !== "all" ? { status } : undefined,
    });
    return response.data;
  },

  /**
   * Get invitations sent by the current user (leader).
   * GET /api/invitations/sent
   */
  async getSentInvitations(params?: {
    status?: string;
    team_id?: string;
  }): Promise<InvitationListResponse> {
    const query: Record<string, string> = {};
    if (params?.status && params.status !== "all") query.status = params.status;
    if (params?.team_id) query.team_id = params.team_id;
    const response = await api.get<InvitationListResponse>("/invitations/sent", {
      params: query,
    });
    return response.data;
  },

  /**
   * Invitee accepts or rejects an invitation.
   * PUT /api/invitations/{invitation_id}/respond
   */
  async respondToInvitation(
    invitationId: string,
    decision: "accepted" | "rejected"
  ): Promise<TeamInvitation> {
    const response = await api.put<TeamInvitation>(
      `/invitations/${invitationId}/respond`,
      { decision }
    );
    return response.data;
  },

  /**
   * Leader cancels a pending invitation.
   * PUT /api/invitations/{invitation_id}/cancel
   */
  async cancelInvitation(invitationId: string): Promise<TeamInvitation> {
    const response = await api.put<TeamInvitation>(`/invitations/${invitationId}/cancel`);
    return response.data;
  },

  /**
   * Get detailed profiles of all members in a team.
   * GET /api/teams/{team_id}/members
   */
  async getTeamMembers(teamId: string): Promise<TeamMemberDetail[]> {
    const response = await api.get<TeamMemberDetail[]>(
      `${teamApiConfig.modulePrefix}/${teamId}/members`
    );
    return response.data;
  },

  /**
   * Leader removes a member from the team.
   * DELETE /api/teams/{team_id}/members/{user_id}
   */
  async removeMember(teamId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `${teamApiConfig.modulePrefix}/${teamId}/members/${userId}`
    );
    return response.data;
  },

  /**
   * Member leaves a team voluntarily.
   * POST /api/teams/{team_id}/leave
   */
  async leaveTeam(teamId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      `${teamApiConfig.modulePrefix}/${teamId}/leave`
    );
    return response.data;
  },

  /**
   * Leader updates a member's role.
   * PUT /api/teams/{team_id}/members/{user_id}/role
   */
  async changeMemberRole(
    teamId: string,
    userId: string,
    role: string
  ): Promise<{ success: boolean; message: string; role: string }> {
    const response = await api.put<{ success: boolean; message: string; role: string }>(
      `${teamApiConfig.modulePrefix}/${teamId}/members/${userId}/role`,
      { role }
    );
    return response.data;
  },

  /**
   * Search users eligible to be invited to a specific team.
   * GET /api/teams/{team_id}/candidate-users?q=...
   */
  async searchCandidateUsers(teamId: string, query: string): Promise<UserSearchCandidate[]> {
    const response = await api.get<UserSearchCandidate[]>(
      `${teamApiConfig.modulePrefix}/${teamId}/candidate-users`,
      { params: { q: query } }
    );
    return response.data;
  },

  /**
   * Search general platform users by name or email.
   * GET /api/users/search?q=...
   */
  async searchUsers(query: string): Promise<UserSearchCandidate[]> {
    const response = await api.get<UserSearchCandidate[]>("/users/search", {
      params: { q: query },
    });
    return response.data;
  },

  // ── PHASE 5: TEAM DISCUSSIONS & COMMENTS ─────────────────────────────────

  /**
   * Create a new discussion thread in a team. Member only.
   * POST /api/teams/{team_id}/discussions
   */
  async createDiscussion(
    teamId: string,
    payload: { title: string; content: string; category?: string }
  ): Promise<TeamDiscussion> {
    const response = await api.post<TeamDiscussion>(
      `${teamApiConfig.modulePrefix}/${teamId}/discussions`,
      payload
    );
    return response.data;
  },

  /**
   * Get discussions for a team with search, category filtering, and pagination.
   * GET /api/teams/{team_id}/discussions
   */
  async getTeamDiscussions(
    teamId: string,
    params?: {
      category?: string;
      search?: string;
      sort?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<DiscussionListResponse> {
    const response = await api.get<DiscussionListResponse>(
      `${teamApiConfig.modulePrefix}/${teamId}/discussions`,
      { params }
    );
    return response.data;
  },

  /**
   * Get single discussion details and permissions. Member only.
   * GET /api/discussions/{discussion_id}
   */
  async getDiscussionDetails(discussionId: string): Promise<TeamDiscussion> {
    const response = await api.get<TeamDiscussion>(`/discussions/${discussionId}`);
    return response.data;
  },

  /**
   * Update discussion title, content, or category. Author or leader only.
   * PUT /api/discussions/{discussion_id}
   */
  async updateDiscussion(
    discussionId: string,
    payload: { title?: string; content?: string; category?: string }
  ): Promise<TeamDiscussion> {
    const response = await api.put<TeamDiscussion>(`/discussions/${discussionId}`, payload);
    return response.data;
  },

  /**
   * Delete discussion and cascade delete associated comments. Author or leader only.
   * DELETE /api/discussions/{discussion_id}
   */
  async deleteDiscussion(discussionId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/discussions/${discussionId}`
    );
    return response.data;
  },

  /**
   * Pin or unpin a discussion. Leader only.
   * PUT /api/discussions/{discussion_id}/pin
   */
  async togglePinDiscussion(discussionId: string, isPinned?: boolean): Promise<TeamDiscussion> {
    const response = await api.put<TeamDiscussion>(`/discussions/${discussionId}/pin`, null, {
      params: isPinned !== undefined ? { is_pinned: isPinned } : undefined,
    });
    return response.data;
  },

  /**
   * Lock or unlock a discussion. Leader only.
   * PUT /api/discussions/{discussion_id}/lock
   */
  async toggleLockDiscussion(discussionId: string, isLocked?: boolean): Promise<TeamDiscussion> {
    const response = await api.put<TeamDiscussion>(`/discussions/${discussionId}/lock`, null, {
      params: isLocked !== undefined ? { is_locked: isLocked } : undefined,
    });
    return response.data;
  },

  /**
   * Add a comment or reply to an unlocked discussion. Member only.
   * POST /api/discussions/{discussion_id}/comments
   */
  async addComment(
    discussionId: string,
    payload: { content: string; parent_comment_id?: string }
  ): Promise<DiscussionComment> {
    const response = await api.post<DiscussionComment>(
      `/discussions/${discussionId}/comments`,
      payload
    );
    return response.data;
  },

  /**
   * Get all comments and nested replies for a discussion.
   * GET /api/discussions/{discussion_id}/comments
   */
  async getDiscussionComments(discussionId: string): Promise<CommentListResponse> {
    const response = await api.get<CommentListResponse>(`/discussions/${discussionId}/comments`);
    return response.data;
  },

  /**
   * Edit own comment. Comment author only.
   * PUT /api/comments/{comment_id}
   */
  async updateComment(
    commentId: string,
    payload: { content: string }
  ): Promise<DiscussionComment> {
    const response = await api.put<DiscussionComment>(`/comments/${commentId}`, payload);
    return response.data;
  },

  /**
   * Delete comment and any replies. Comment author or team leader only.
   * DELETE /api/comments/{comment_id}
   */
  async deleteComment(commentId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/comments/${commentId}`
    );
    return response.data;
  },

  // ── Phase 6: Team Task Management APIs ────────────────────────────────────

  /**
   * Create a new task in a team (Team Leader only).
   * POST /api/teams/{team_id}/tasks
   */
  async createTask(teamId: string, payload: CreateTaskPayload): Promise<TeamTask> {
    const response = await api.post<TeamTask>(`/teams/${teamId}/tasks`, payload);
    return response.data;
  },

  /**
   * Get tasks for a team with search, filters, and pagination.
   * GET /api/teams/{team_id}/tasks
   */
  async getTeamTasks(
    teamId: string,
    params?: {
      search?: string;
      status?: string;
      priority?: string;
      assigned_to?: string;
      sort_by?: string;
      sort_order?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<TaskListResponse> {
    const response = await api.get<TaskListResponse>(`/teams/${teamId}/tasks`, { params });
    return response.data;
  },

  /**
   * Get all tasks assigned to the authenticated user across teams.
   * GET /api/tasks/my
   */
  async getMyTasks(params?: {
    status?: string;
    priority?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    limit?: number;
  }): Promise<TaskListResponse> {
    const response = await api.get<TaskListResponse>("/tasks/my", { params });
    return response.data;
  },

  /**
   * Get details and permissions for a single task.
   * GET /api/tasks/{task_id}
   */
  async getTaskDetails(taskId: string): Promise<TeamTask> {
    const response = await api.get<TeamTask>(`/tasks/${taskId}`);
    return response.data;
  },

  /**
   * Update task details (Team Leader or creator).
   * PUT /api/tasks/{task_id}
   */
  async updateTask(taskId: string, payload: UpdateTaskPayload): Promise<TeamTask> {
    const response = await api.put<TeamTask>(`/tasks/${taskId}`, payload);
    return response.data;
  },

  /**
   * Update task status (Assigned members or Team Leader).
   * PATCH /api/tasks/{task_id}/status
   */
  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<TeamTask> {
    const response = await api.patch<TeamTask>(`/tasks/${taskId}/status`, { status });
    return response.data;
  },

  /**
   * Update task progress (0-100) (Assigned members or Team Leader).
   * PATCH /api/tasks/{task_id}/progress
   */
  async updateTaskProgress(taskId: string, progress: number): Promise<TeamTask> {
    const response = await api.patch<TeamTask>(`/tasks/${taskId}/progress`, { progress });
    return response.data;
  },

  /**
   * Reassign task members (Team Leader only).
   * PATCH /api/tasks/{task_id}/assign
   */
  async reassignTask(taskId: string, assigned_to: string[]): Promise<TeamTask> {
    const response = await api.patch<TeamTask>(`/tasks/${taskId}/assign`, { assigned_to });
    return response.data;
  },

  /**
   * Delete task (Team Leader or creator).
   * DELETE /api/tasks/{task_id}
   */
  async deleteTask(taskId: string): Promise<{ message: string; task_id: string }> {
    const response = await api.delete<{ message: string; task_id: string }>(`/tasks/${taskId}`);
    return response.data;
  },
};

export default teamApi;
