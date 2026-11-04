import api from "./api";

const authService = {
  register: (data) => api.post("/auth/register", data),

  login: async (credentials) => {
    const res = await api.post("/auth/login", credentials);
    if (res.data.accessToken) {
      localStorage.setItem("accessToken", res.data.accessToken);
    }
    return res;
  },

  logout: async (refreshToken) => {
    await api.post("/auth/logout", { refreshToken });
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  },

  getMe: () => api.get("/auth/me"),

  refreshToken: (refreshToken) =>
    api.post("/auth/refresh", { refreshToken }),

  forgotPassword: (email) =>
    api.post("/auth/forgot-password", { email }),

  resetPassword: (token, newPassword, confirmPassword) =>
    api.post("/auth/reset-password", { token, newPassword, confirmPassword }),

  // Profile
  getProfile: () => api.get("/users/profile"),

  updateProfile: (data) => api.put("/users/profile", data),

  changePassword: (data) => api.put("/users/change-password", data),

  uploadProfileImage: (formData) =>
    api.put("/users/profile-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

export default authService;
