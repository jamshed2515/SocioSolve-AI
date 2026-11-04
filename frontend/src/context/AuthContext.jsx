import { createContext, useContext, useState, useEffect, useCallback } from "react";
import authService from "../services/authService";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext(null);

const ROLE_DASHBOARD = {
  citizen:    "/dashboard/citizen",
  student:    "/dashboard/student",
  university: "/dashboard/university",
  industry:   "/dashboard/industry",
  admin:      "/dashboard/admin",
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  /* ── Restore session on mount ─────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      authService.getMe()
        .then(res => setUser(res.data))
        .catch(() => { localStorage.removeItem("accessToken"); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /* ── Login ───────────────────────────────────────────── */
  const login = useCallback(async (credentials) => {
    const res  = await authService.login(credentials);
    const data = res.data;
    localStorage.setItem("accessToken", data.accessToken);
    setUser(data.user);
    navigate(ROLE_DASHBOARD[data.user.role] || "/");
    return data;
  }, [navigate]);

  /* ── Register ────────────────────────────────────────── */
  const register = useCallback(async (payload) => {
    const res = await authService.register(payload);
    return res.data;
  }, []);

  /* ── Logout ──────────────────────────────────────────── */
  const logout = useCallback(async () => {
    try { await authService.logout(); } catch (_) {}
    localStorage.removeItem("accessToken");
    setUser(null);
    navigate("/login");
  }, [navigate]);

  /* ── Update user in context (after profile edit) ─────── */
  const updateUser = useCallback((updated) => {
    setUser(prev => ({ ...prev, ...updated }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, updateUser, ROLE_DASHBOARD }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
