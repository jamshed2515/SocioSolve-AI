import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const schema = z.object({
  email:    z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { login } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data);
      toast.success("Welcome back! 🎉");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      {/* Background glow blobs */}
      <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-slide-up relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500/20 border border-primary-500/30 mb-4 glow">
            <Zap className="w-8 h-8 text-primary-400" />
          </div>
          <h1 className="text-3xl font-bold text-gradient">SocioSolve-AI</h1>
          <p className="text-white/50 mt-1 text-sm">Societal Challenges Platform</p>
        </div>

        {/* Card */}
        <div className="glass p-8">
          <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-white/40 text-sm mb-6">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input
                id="login-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                {...register("email")}
              />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? "text" : "password"}
                  className="input pr-11"
                  placeholder="••••••••"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>

            {/* Forgot password */}
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={18} /> Sign In</>
              )}
            </button>
          </form>

          <p className="text-center text-white/40 text-sm mt-6">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium transition">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
