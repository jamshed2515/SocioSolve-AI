import api from "./api";
import { auth, googleProvider } from "../config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  sendEmailVerification,
  updateProfile as fbUpdateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";

/** Human-friendly messages for Firebase error codes */
export function firebaseErrorMessage(err) {
  const map = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Invalid email address.",
    "auth/weak-password": "Password is too weak.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "Invalid email or password.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/popup-blocked": "Popup was blocked by your browser. Please allow popups and try again.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase Authentication.",
    "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
    "auth/expired-action-code": "This reset link has expired.",
    "auth/invalid-action-code": "This reset link is invalid or already used.",
    "auth/requires-recent-login": "Please sign in again to continue.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[err?.code] || err?.response?.data?.detail || err?.message || "Something went wrong";
}

const authService = {
  // ── Firebase identity ────────────────────────────────────────
  registerWithEmail: async ({ name, email, password }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await fbUpdateProfile(cred.user, { displayName: name }).catch(() => {});
    sendEmailVerification(cred.user).catch(() => {});
    return cred.user;
  },

  loginWithEmail: ({ email, password }) => signInWithEmailAndPassword(auth, email, password),

  loginWithGoogle: () => signInWithPopup(auth, googleProvider),

  logout: async () => {
    try {
      if (auth.currentUser) await api.post("/auth/logout"); // revoke refresh tokens server-side
    } finally {
      await signOut(auth);
    }
  },

  forgotPassword: (email) =>
    sendPasswordResetEmail(auth, email, {
      url: `${window.location.origin}/login`,
    }),

  verifyResetCode: (oobCode) => verifyPasswordResetCode(auth, oobCode),
  resetPassword: (oobCode, newPassword) => confirmPasswordReset(auth, oobCode, newPassword),

  // ── Backend (token verified server-side) ─────────────────────
  syncUser: (profile = {}) => api.post("/auth/sync-user", profile),
  getMe: () => api.get("/auth/me"),

  getProfile: () => api.get("/users/profile"),
  updateProfile: (data) => api.put("/users/profile", data),

  /** Re-authenticate with current password, then let the backend change it. */
  changePassword: async ({ currentPassword, newPassword, confirmPassword }) => {
    const user = auth.currentUser;
    if (!user?.email) throw new Error("Not signed in");
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await user.getIdToken(true); // fresh token with recent auth_time
    return api.put("/users/change-password", { newPassword, confirmPassword });
  },

  uploadProfileImage: (formData) =>
    api.put("/users/profile-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  // ── Admin approval & user management ─────────────────────────
  getPendingUsers: () => api.get("/admin/users/pending"),
  setUserApproval: (userId, approve) =>
    api.put(`/admin/users/${userId}/approval`, { approve }),
  setUserActive: (userId, active) =>
    api.put(`/admin/users/${userId}/active`, null, { params: { active } }),
};

export default authService;
