import api from "./api";

/**
 * Service client for Module 2: Societal Challenge Management.
 * Reuses the authenticated Axios instance from api.js with Bearer token interceptor.
 */
export const challengeService = {
  /**
   * List / discover challenges with search, category, location, difficulty, sort, and pagination.
   * @param {Object} params - { search, category, location, difficulty, status, sortBy, page, limit }
   */
  getChallenges: async (params = {}) => {
    const { data } = await api.get("/challenges", { params });
    return data;
  },

  /**
   * Fetch a single challenge by MongoDB ObjectId or challengeCode.
   * @param {string} challengeId
   */
  getChallengeById: async (challengeId) => {
    const { data } = await api.get(`/challenges/${challengeId}`);
    return data;
  },

  /**
   * List challenges authored by the current authenticated user (including drafts).
   * @param {Object} params - { status, page, limit }
   */
  getMyChallenges: async (params = {}) => {
    const { data } = await api.get("/challenges/my", { params });
    return data;
  },

  /**
   * Create a new challenge (status can be 'draft', 'submitted', or 'published').
   * @param {Object} payload - ChallengeCreateRequest
   */
  createChallenge: async (payload) => {
    const { data } = await api.post("/challenges", payload);
    return data;
  },

  /**
   * Update an existing challenge (Author or Admin only).
   * @param {string} challengeId
   * @param {Object} payload - ChallengeUpdateRequest
   */
  updateChallenge: async (challengeId, payload) => {
    const { data } = await api.put(`/challenges/${challengeId}`, payload);
    return data;
  },

  /**
   * Delete a challenge (Author or Admin only; blocked if active proposals or teams exist).
   * @param {string} challengeId
   */
  deleteChallenge: async (challengeId) => {
    const { data } = await api.delete(`/challenges/${challengeId}`);
    return data;
  },

  /**
   * Transition challenge lifecycle status (Admin workflow or Author withdrawal).
   * @param {string} challengeId
   * @param {Object} payload - { status, reason }
   */
  updateChallengeStatus: async (challengeId, { status, reason }) => {
    const { data } = await api.patch(`/challenges/${challengeId}/status`, { status, reason });
    return data;
  },

  /**
   * Upload an image or document attachment using multipart/form-data.
   * Backed by Cloudinary with automatic local disk fallback.
   * @param {File} file
   */
  uploadAttachment: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post("/challenges/upload-attachment", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  /**
   * Fetch all societal domain categories and challenge distribution counts.
   */
  getCategories: async () => {
    const { data } = await api.get("/challenges/categories");
    return data;
  },
};

export default challengeService;
