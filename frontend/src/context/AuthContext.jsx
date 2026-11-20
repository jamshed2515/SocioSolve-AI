import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../config/firebase";
import authService from "../services/authService";

const AuthContext = createContext(null);

const ROLE_DASHBOARD = {
  citizen:    "/dashboard/citizen",
  student:    "/dashboard/student",
  university: "/dashboard/university",
  industry:   "/dashboard/industry",
  admin:      "/dashboard/admin",
};

// Registration details kept only until the backend profile exists (no tokens/passwords).
const PENDING_KEY = "sociosolve.pendingProfile";
const readPending = () => {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY)) || null; } catch { return null; }
};
const writePending = (p) => sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
const clearPending = () => sessionStorage.removeItem(PENDING_KEY);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [user, setUser]                 = useState(null);   // backend profile (trusted role)
  const [loading, setLoading]           = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);  // signed in but no MongoDB profile yet
  const [syncError, setSyncError]       = useState(null);
  const inflight = useRef(null);
  const navigate = useNavigate();

  /**
   * Idempotent backend sync. De-duplicates concurrent calls for the same Firebase user,
   * so registration + onAuthStateChanged never create two profiles.
   */
  const ensureSynced = useCallback(async (fbUser) => {
    if (inflight.current?.uid === fbUser.uid) return inflight.current.promise;
    const promise = (async () => {
      try {
        const pending = readPending();
        const { data } = await authService.syncUser(pending || {});
        clearPending();
        setUser(data.user);
        setNeedsProfile(false);
        setSyncError(null);
        return { user: data.user };
      } catch (err) {
        if (err?.response?.status === 422 && !readPending()) {
          setUser(null);
          setNeedsProfile(true);
          return { needsProfile: true };
        }
        // Firebase account exists but profile sync failed -> keep pending data for retry
        setSyncError(err?.response?.data?.detail || "Could not reach the server.");
        throw err;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = { uid: fbUser.uid, promise };
    return promise;
  }, []);

  /* ── Firebase session persistence ─────────────────────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUser(null);
        setNeedsProfile(false);
        setSyncError(null);
        setLoading(false);
        return;
      }
      try { await ensureSynced(fbUser); } catch { /* syncError already set */ }
      setLoading(false);
    });
    return unsub;
  }, [ensureSynced]);

  const goHome = useCallback((result) => {
    if (result?.needsProfile) navigate("/complete-profile");
    else if (result?.user) navigate(ROLE_DASHBOARD[result.user.role] || "/");
  }, [navigate]);

  /* ── Email / password login ───────────────────────────────── */
  const login = useCallback(async ({ email, password }) => {
    const cred = await authService.loginWithEmail({ email, password });
    const result = await ensureSynced(cred.user);
    goHome(result);
    return result;
  }, [ensureSynced, goHome]);

  /* ── Google sign-in ───────────────────────────────────────── */
  const loginWithGoogle = useCallback(async () => {
    const cred = await authService.loginWithGoogle();
    const result = await ensureSynced(cred.user);
    goHome(result);
    return result;
  }, [ensureSynced, goHome]);

  /* ── Registration (Firebase account + MongoDB profile) ────── */
  const register = useCallback(async ({ name, email, password, phone, role, organization }) => {
    writePending({ name, phone: phone || undefined, requestedRole: role, organization });
    let fbUser;
    try {
      fbUser = await authService.registerWithEmail({ name, email, password });
    } catch (err) {
      clearPending();
      throw err;
    }
    const result = await ensureSynced(fbUser);
    goHome(result);
    return result;
  }, [ensureSynced, goHome]);

  /* ── Complete profile (e.g. first Google sign-in) ─────────── */
  const completeProfile = useCallback(async (profile) => {
    if (!auth.currentUser) throw new Error("Not signed in");
    writePending(profile);
    const result = await ensureSynced(auth.currentUser);
    goHome(result);
    return result;
  }, [ensureSynced, goHome]);

  const retrySync = useCallback(async () => {
    if (!auth.currentUser) return;
    const result = await ensureSynced(auth.currentUser);
    goHome(result);
  }, [ensureSynced, goHome]);

  /* ── Logout ───────────────────────────────────────────────── */
  const logout = useCallback(async () => {
    try { await authService.logout(); } catch { /* signOut still runs */ }
    clearPending();
    setUser(null);
    navigate("/login");
  }, [navigate]);

  const updateUser = useCallback((updated) => {
    setUser((prev) => (prev ? { ...prev, ...updated } : prev));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user, firebaseUser, loading, needsProfile, syncError,
        login, loginWithGoogle, register, completeProfile, retrySync, logout, updateUser,
        ROLE_DASHBOARD,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
