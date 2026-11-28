import api, { BACKEND_ORIGIN } from "./api";

export const proposalService = {
  // Dashboard KPIs & distribution
  getDashboardStats: async (scope = "all") => {
    const { data } = await api.get("/proposals/dashboard-stats", { params: { scope } });
    return data;
  },

  // Live role-specific dashboard stats (Student, Citizen, University, Industry, Admin)
  getRoleDashboard: async (role) => {
    const { data } = await api.get(`/dashboard/${role}`);
    return data;
  },

  // Rubric criteria configuration (backend-authoritative 1-10 scale, max 50)
  getRubricCriteria: async () => {
    const { data } = await api.get("/proposals/rubric-criteria");
    return data;
  },

  // Published challenges from Module 2
  getPublishedChallenges: async () => {
    const { data } = await api.get("/proposals/challenges/published");
    return data;
  },

  // User teams from Module 3
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

  markAllNotificationsRead: async () => {
    const { data } = await api.put("/proposals/notifications/read-all");
    return data;
  },

  // Real-time WebSocket URL for Module 4 notifications
  getNotificationsWebSocketUrl: (token) => {
    const wsOrigin = BACKEND_ORIGIN.replace(/^http/i, "ws");
    return `${wsOrigin}/api/proposals/ws/notifications?token=${encodeURIComponent(token)}`;
  },

  // Upload supporting document (returns protected document endpoint URL)
  uploadDocument: async (file, docType = "supporting_document") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("docType", docType);
    const { data } = await api.post("/proposals/upload-document", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // Open either an external URL or an authenticated backend-protected document
  openProtectedDocument: async (docUrl, fallbackName = "document") => {
    if (!docUrl) return;
    const isProtectedApiDoc = docUrl.includes("/api/proposals/documents/");
    if (!isProtectedApiDoc) {
      const target =
        docUrl.startsWith("http://") || docUrl.startsWith("https://")
          ? docUrl
          : `${BACKEND_ORIGIN}${docUrl.startsWith("/") ? "" : "/"}${docUrl}`;
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }

    // Extract API-relative path so Axios attaches Firebase Bearer token
    const apiIdx = docUrl.indexOf("/api/");
    const relPath = apiIdx >= 0 ? docUrl.slice(apiIdx + 4) : docUrl;
    const res = await api.get(relPath, { responseType: "blob" });
    const blobUrl = window.URL.createObjectURL(res.data);
    const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fallbackName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
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

  // Reopen withdrawn proposal back to draft (M1 controlled workflow)
  reopenProposal: async (proposalId, reason = "Reopened as draft for revision.") => {
    const { data } = await api.post(`/proposals/${proposalId}/reopen`, { reason });
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
