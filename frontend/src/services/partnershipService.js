import api from "./api";

const partnershipService = {
  // ── Opportunities ──────────────────────────────────────────────────────────
  getOpportunities: (params = {}) => api.get("/partnerships", { params }),

  getOpportunityById: (id) => api.get(`/partnerships/${id}`),

  getMyOpportunities: () => api.get("/partnerships/my/opportunities"),

  getMyIncomingApplications: () => api.get("/partnerships/my/incoming-applications"),

  createOpportunity: (data) => api.post("/partnerships", data),

  updateOpportunityStatus: (id, status) => api.patch(`/partnerships/${id}/status`, { status }),

  // ── Applications ───────────────────────────────────────────────────────────
  applyToOpportunity: (id, data) => api.post(`/partnerships/${id}/apply`, data),

  getMyApplications: () => api.get("/partnerships/my/applications"),

  getOpportunityApplications: (id) => api.get(`/partnerships/${id}/applications`),

  updateApplicationStatus: (applicationId, status, feedback = null) =>
    api.patch(`/partnerships/applications/${applicationId}/status`, { status, feedback }),
};

export default partnershipService;

