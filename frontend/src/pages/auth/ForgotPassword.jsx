import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Zap } from "lucide-react";
import authService from "../../services/authService";
import toast from "react-hot-toast";

export default function ForgotPassword() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error("Please enter your email");
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="absolute top-20 left-1/3 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-slide-up relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/20 border border-primary-500/30 mb-4 glow">
            <Zap className="w-7 h-7 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">SocioSolve-AI</h1>
        </div>

        <div className="glass p-8">
          {!submitted ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center mb-4">
                <Mail className="text-primary-400" size={22} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-1">Forgot your password?</h2>
              <p className="text-white/40 text-sm mb-6">
                Enter your email and we'll send you a reset link (or print it to console in dev mode).
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email address</label>
                  <input
                    id="forgot-email"
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <button id="forgot-submit" type="submit" disabled={loading} className="btn-primary w-full">
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Mail size={18} /> Send Reset Link</>}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-accent-400/20 flex items-center justify-center mx-auto mb-4">
                <Mail className="text-accent-400" size={28} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Check your email</h2>
              <p className="text-white/50 text-sm">
                If <span className="text-primary-400 font-medium">{email}</span> exists in our system,
                a reset link has been sent. Check your console in dev mode.
              </p>
            </div>
          )}

          <Link to="/login"
            className="flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white transition mt-6">
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
