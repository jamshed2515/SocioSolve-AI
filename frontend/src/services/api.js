import axios from "axios";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const RAW_API_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api"
).replace(/\/+$/, "");
export const BACKEND_ORIGIN = RAW_API_URL.endsWith("/api")
  ? RAW_API_URL.slice(0, -4)
  : RAW_API_URL;
export const API_BASE_URL = `${BACKEND_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach a fresh Firebase ID token (SDK auto-refreshes it before expiry)
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, force-refresh the token once and retry; if it still fails, sign out.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && auth.currentUser) {
      original._retry = true;
      try {
        const token = await auth.currentUser.getIdToken(true);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        // fall through to sign-out
      }
    }
    if (error.response?.status === 401 && original?._retry) {
      await signOut(auth).catch(() => {});
    }
    return Promise.reject(error);
  }
);

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
export default api;
