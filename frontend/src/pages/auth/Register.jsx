import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, UserPlus, Zap, ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

/* ── Validation schemas per step ──────────────────────────────────────────── */
const step1Schema = z.object({
  name:            z.string().min(2, "Name must be at least 2 characters"),
  email:           z.string().email("Enter a valid email"),
  password:        z.string()
    .min(8, "Min 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
  confirmPassword: z.string(),
  phone:           z.string().optional(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const ROLES = [
  { value: "citizen",    label: "Citizen",          emoji: "🏘️", desc: "Report societal problems" },
  { value: "student",    label: "Student",           emoji: "🎓", desc: "Join challenges & projects" },
  { value: "university", label: "University",        emoji: "🏛️", desc: "Manage institutional info" },
  { value: "industry",   label: "Industry Partner",  emoji: "🏢", desc: "Provide mentorship & resources" },
];

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]         = useState(1);   // 1=basic, 2=role, 3=org details
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [showCPwd, setShowCPwd] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [formData, setFormData] = useState({});

  const { register, handleSubmit, formState: { errors }, getValues } = useForm({
    resolver: zodResolver(step1Schema),
  });

  const needsOrg = ["university", "industry"].includes(selectedRole);

  /* ── Step 1: basic info ──────────────────────────────────── */
  const handleStep1 = handleSubmit((data) => {
    setFormData(data);
    setStep(2);
  });

  /* ── Step 2: role selection ──────────────────────────────── */
  const handleStep2 = () => {
    if (!selectedRole) return toast.error("Please select a role");
    if (needsOrg) return setStep(3);
    submitRegistration({});
  };

  /* ── Step 3 & final submit ───────────────────────────────── */
  const submitRegistration = async (orgData = {}) => {
    setLoading(true);
    try {
      const payload = {
        name:            formData.name,
        email:           formData.email,
        password:        formData.password,
        confirmPassword: formData.confirmPassword,
        phone:           formData.phone || undefined,
        role:            selectedRole,
        organization:    Object.keys(orgData).length ? orgData : undefined,
      };
      await registerUser(payload);
      toast.success("Account created! Please log in.");
      navigate("/login");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4 py-10">
      <div className="absolute top-20 right-1/4 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg animate-slide-up relative z-10">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/20 border border-primary-500/30 mb-3 glow">
            <Zap className="w-7 h-7 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">SocioSolve-AI</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, needsOrg ? 3 : null].filter(Boolean).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${step >= s ? "bg-primary-500 text-white" : "bg-white/10 text-white/40"}`}>
                {s}
              </div>
              {s < (needsOrg ? 3 : 2) && (
                <div className={`w-10 h-0.5 ${step > s ? "bg-primary-500" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="glass p-8">
          {/* ── STEP 1: Basic Info ─────────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">Create your account</h2>
              <p className="text-white/40 text-sm mb-6">Fill in your basic information</p>

              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="label">Full Name</label>
                  <input id="reg-name" className="input" placeholder="Your full name" {...register("name")} />
                  {errors.name && <p className="error-text">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="label">Email Address</label>
                  <input id="reg-email" type="email" className="input" placeholder="you@example.com" {...register("email")} />
                  {errors.email && <p className="error-text">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="label">Phone (optional)</label>
                  <input id="reg-phone" className="input" placeholder="+92 300 0000000" {...register("phone")} />
                </div>

                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input id="reg-password" type={showPwd ? "text" : "password"} className="input pr-11"
                      placeholder="Min 8 chars, 1 uppercase, 1 number" {...register("password")} />
                    <button type="button" onClick={() => setShowPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>

                <div>
                  <label className="label">Confirm Password</label>
                  <div className="relative">
                    <input id="reg-confirm-password" type={showCPwd ? "text" : "password"} className="input pr-11"
                      placeholder="Repeat your password" {...register("confirmPassword")} />
                    <button type="button" onClick={() => setShowCPwd(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                      {showCPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
                </div>

                <button id="reg-next-step1" type="submit" className="btn-primary w-full mt-2">
                  Next <ChevronRight size={18} />
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: Role Selection ─────────────────────── */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">Choose your role</h2>
              <p className="text-white/40 text-sm mb-6">Select the role that best describes you</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    id={`role-${r.value}`}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`p-4 rounded-xl border text-left transition-all
                      ${selectedRole === r.value
                        ? "border-primary-500 bg-primary-500/20"
                        : "border-white/10 bg-white/5 hover:border-white/30"}`}
                  >
                    <div className="text-2xl mb-1">{r.emoji}</div>
                    <div className="text-sm font-semibold text-white">{r.label}</div>
                    <div className="text-xs text-white/40 mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1">
                  <ChevronLeft size={18} /> Back
                </button>
                <button id="reg-next-step2" type="button" onClick={handleStep2}
                  disabled={!selectedRole || loading} className="btn-primary flex-1">
                  {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : needsOrg ? <><span>Next</span><ChevronRight size={18}/></> : <><UserPlus size={18} /> Register</>}
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Organization Details ──────────────── */}
          {step === 3 && (
            <OrgStep
              role={selectedRole}
              onBack={() => setStep(2)}
              onSubmit={submitRegistration}
              loading={loading}
            />
          )}
        </div>

        <p className="text-center text-white/40 text-sm mt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

/* ── Organization details sub-form ────────────────────────────────────────── */
function OrgStep({ role, onBack, onSubmit, loading }) {
  const [org, setOrg] = useState({ name: "", type: role, address: "", website: "", description: "" });
  const set = (k) => (e) => setOrg(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <>
      <h2 className="text-xl font-semibold text-white mb-1">Organization Details</h2>
      <p className="text-white/40 text-sm mb-6">
        Tell us about your {role === "university" ? "institution" : "company"}
      </p>

      <div className="space-y-4">
        <div>
          <label className="label">{role === "university" ? "Institution" : "Company"} Name *</label>
          <input id="org-name" className="input" placeholder="e.g. LUMS / TechCorp" value={org.name} onChange={set("name")} />
        </div>
        <div>
          <label className="label">Address</label>
          <input id="org-address" className="input" placeholder="City, Country" value={org.address} onChange={set("address")} />
        </div>
        <div>
          <label className="label">Website</label>
          <input id="org-website" className="input" placeholder="https://example.com" value={org.website} onChange={set("website")} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea id="org-desc" className="input resize-none h-20" placeholder="Brief description..."
            value={org.description} onChange={set("description")} />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button type="button" onClick={onBack} className="btn-ghost flex-1">
          <ChevronLeft size={18} /> Back
        </button>
        <button id="reg-submit-final" type="button"
          onClick={() => onSubmit(org)}
          disabled={!org.name || loading}
          className="btn-primary flex-1">
          {loading
            ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><UserPlus size={18} /> Register</>}
        </button>
      </div>
    </>
  );
}
