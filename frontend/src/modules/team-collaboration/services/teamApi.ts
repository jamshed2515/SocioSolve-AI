import axios from "axios";
import api, { API_BASE_URL, BACKEND_ORIGIN } from "../../../services/api";
import type { HealthResponse, ModuleStatusResponse } from "../types";

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
  modulePrefix: "/team-collaboration",
} as const;

export const teamApi = {
  /**
   * Shared Axios instance authenticated via Module 1 JWT interceptors.
   * Future Phase 2+ endpoints will call `teamApi.client.get/post(...)`.
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
   * Call Module 3 foundation status endpoint (`GET /api/team-collaboration/status`).
   */
  async getModuleStatus(): Promise<ModuleStatusResponse> {
    const response = await api.get<ModuleStatusResponse>(
      `${teamApiConfig.modulePrefix}/status`,
      { timeout: 5000 }
    );
    return response.data;
  },
};

export default teamApi;

