import axios from "axios";
import api, { API_BASE_URL, BACKEND_ORIGIN } from "../../../services/api";
import type {
  ChallengeOption,
  CreateJoinRequestPayload,
  CreateTeamPayload,
  HealthResponse,
  JoinRequest,
  JoinRequestDecisionPayload,
  JoinRequestListResponse,
  ModuleStatusResponse,
  Team,
  TeamListResponse,
  UpdateTeamPayload,
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
};

export default teamApi;
