import api from "./api";

export const proposalService = {
  // Dashboard KPIs & distribution
  getDashboardStats: async (scope = "all") => {
    const { data } = await api.get("/proposals/dashboard-stats", { params: { scope } });
    return data;
  },

  // Rubric criteria configuration
  getRubricCriteria: async () => {
    const { data } = await api.get("/proposals/rubric-criteria");
    return data;
  },

  // Published challenges from Module 2 / seed
  getPublishedChallenges: async () => {
    const { data } = await api.get("/proposals/challenges/published");
    return data;
  },

  // User teams from Module 3 if available
  getMyTeams: async () => {
    const { data } = await api.get("/proposals/teams/my-teams");
    return data;
  },

  // Notifications
  getNotifications: async () => {
    const { data } = await api.get("/proposals/notifications");
    return data;
  },

  markNotificationRead: async (notificationId) => {
    const { data } = await api.put(`/proposals/notifications/${notificationId}/read`);
    return data;
  },

  // Upload supporting document
  uploadDocument: async (file, docType = "supporting_document") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docType", docType);
    const { data } = await api.post("/proposals/upload-document", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // List proposals with search, filter, sort & pagination
  listProposals: async (params = {}) => {
    const { data } = await api.get("/proposals", { params });
    return data;
  },

  // Current user's proposals
  listMyProposals: async (params = {}) => {
    const { data } = await api.get("/proposals/my", { params });
    return data;
  },

  // Reviewer queue
  listReviewQueue: async (params = {}) => {
    const { data } = await api.get("/proposals/review-queue", { params });
    return data;
  },

  // Get single proposal details + reviews + status history
  getProposalById: async (proposalId) => {
    const { data } = await api.get(`/proposals/${proposalId}`);
    return data;
  },

  // Create proposal (draft or immediate submit)
  createProposal: async (payload) => {
    const { data } = await api.post("/proposals", payload);
    return data;
  },

  // Update draft proposal
  updateProposal: async (proposalId, payload) => {
    const { data } = await api.put(`/proposals/${proposalId}`, payload);
    return data;
  },

  // Delete draft proposal
  deleteDraftProposal: async (proposalId) => {
    const { data } = await api.delete(`/proposals/${proposalId}`);
    return data;
  },

  // Submit draft proposal
  submitProposal: async (proposalId) => {
    const { data } = await api.post(`/proposals/${proposalId}/submit`);
    return data;
  },

  // Withdraw submitted proposal
  withdrawProposal: async (proposalId, reason) => {
    const { data } = await api.post(`/proposals/${proposalId}/withdraw`, { reason });
    return data;
  },

  // Get reviews for a proposal
  getProposalReviews: async (proposalId) => {
    const { data } = await api.get(`/proposals/${proposalId}/reviews`);
    return data;
  },

  // Save review draft or submit official review
  upsertReview: async (proposalId, payload) => {
    const { data } = await api.post(`/proposals/${proposalId}/reviews`, payload);
    return data;
  },

  // Submit official review (alias for POST /proposals/{id}/review)
  submitReview: async (proposalId, payload) => {
    const { data } = await api.post(`/proposals/${proposalId}/review`, payload);
    return data;
  },

  // Get status history
  getStatusHistory: async (proposalId) => {
    const { data } = await api.get(`/proposals/${proposalId}/status-history`);
    return data;
  },

  // Get full immutable evaluation review history
  getReviewHistory: async (proposalId) => {
    const { data } = await api.get(`/proposals/${proposalId}/review-history`);
    return data;
  },

  // Change status through controlled workflow (Submitted -> Under Review -> Accepted/Rejected)
  changeStatus: async (proposalId, toStatus, comment) => {
    const { data } = await api.post(`/proposals/${proposalId}/status`, {
      toStatus,
      comment,
    });
    return data;
  },

  // Update status (alias for PATCH /proposals/{id}/status)
  updateStatus: async (proposalId, toStatus, comment) => {
    const { data } = await api.patch(`/proposals/${proposalId}/status`, {
      toStatus,
      comment,
    });
    return data;
  },
};

export default proposalService;
