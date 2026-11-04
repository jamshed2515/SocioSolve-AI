import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Zap, CheckCircle } from "lucide-react";
import authService from "../../services/authService";
import toast from "react-hot-toast";

export default function ResetPassword() {
  const [params]          = useSearchParams();
  const navigate          = useNavigate();
  const token             = params.get("token") || "";
  const [newPwd, setNewPwd]       = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPwd.length < 8)             return toast.error("Min 8 characters");
    if (!/[A-Z]/.test(newPwd))         return toast.error("Must contain uppercase letter");
    if (!/[0-9]/.test(newPwd))         return toast.error("Must contain a number");
    if (newPwd !== confirmPwd)         return toast.error("Passwords do not match");

    setLoading(true);
    try {
      await authService.resetPassword(token, newPwd, confirmPwd);
      setDone(true);
      toast.success("Password reset successfully!");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid or expired token");
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="glass p-8 text-center max-w-sm">
        <p className="text-red-400 mb-4">Invalid reset link. No token found.</p>
        <Link to="/forgot-password" className="btn-primary">Request a new link</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="absolute top-20 right-1/3 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-slide-up relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/20 border border-primary-500/30 mb-4 glow">
            <Zap className="w-7 h-7 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">SocioSolve-AI</h1>
        </div>

        <div className="glass p-8">
          {!done ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center mb-4">
                <KeyRound className="text-primary-400" size={22} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-1">Set new password</h2>
              <p className="text-white/40 text-sm mb-6">
                Min 8 characters · 1 uppercase · 1 number
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input id="reset-password" type={showPwd ? "text" : "password"} className="input pr-11"
                      placeholder="New password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input id="reset-confirm-password" type="password" className="input"
                    placeholder="Confirm new password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
                </div>
                <button id="reset-submit" type="submit" disabled={loading} className="btn-primary w-full">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><KeyRound size={18} /> Reset Password</>}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-400" size={28} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Password reset!</h2>
              <p className="text-white/50 text-sm mb-6">Your password has been updated. You can now log in.</p>
              <button onClick={() => navigate("/login")} className="btn-primary w-full">
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
