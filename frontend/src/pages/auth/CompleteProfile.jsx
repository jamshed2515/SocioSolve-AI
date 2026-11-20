import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, ChevronLeft, UserPlus, Zap, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { firebaseErrorMessage } from "../../services/authService";
import toast from "react-hot-toast";

/* ── Validation schema for org details step ───────────────────────────────── */
const orgSchema = z.object({
  name:        z.string().min(2, "Organization name is required"),
  address:     z.string().optional(),
  website:     z.string().optional(),
  description: z.string().optional(),
});

const ROLES = [
  { value: "citizen",    label: "Citizen",          emoji: "🏘️", desc: "Report societal problems" },
  { value: "student",    label: "Student",           emoji: "🎓", desc: "Join challenges & projects" },
  { value: "university", label: "University",        emoji: "🏛️", desc: "Manage institutional info" },
  { value: "industry",   label: "Industry Partner",  emoji: "🏢", desc: "Provide mentorship & resources" },
];

export default function CompleteProfile() {
  const { completeProfile, syncError, firebaseUser } = useAuth();

  const [step, setStep]         = useState(1);  // 1=role, 2=org-details (org/industry only)
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading]   = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(orgSchema),
  });

  const needsOrg = ["university", "industry"].includes(selectedRole);

  /* ── Step 1: role selection ──────────────────────────────── */
  const handleStep1 = () => {
    if (!selectedRole) return toast.error("Please choose a role to continue.");
    if (needsOrg) return setStep(2);
    submit({});
  };

  /* ── Step 2 / final submit ───────────────────────────────── */
  const submit = async (orgData = {}) => {
    setLoading(true);
    try {
      const payload = {
        requestedRole: selectedRole,
        organization:  Object.keys(orgData).some(k => orgData[k]) ? { type: selectedRole, ...orgData } : undefined,
      };
      await completeProfile(payload);
      toast.success("Profile created! Welcome to SocioSolve-AI 🎉");
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const onOrgSubmit = handleSubmit((data) => submit(data));

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
          <p className="text-white/50 mt-1 text-sm">Complete your profile to continue</p>
        </div>

        {/* Sync error banner */}
        {syncError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-sm text-red-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{syncError}</span>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, needsOrg ? 2 : null].filter(Boolean).map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                ${step >= s ? "bg-primary-500 text-white" : "bg-white/10 text-white/40"}`}>
                {s}
              </div>
              {s < (needsOrg ? 2 : 1) && (
                <div className={`w-10 h-0.5 ${step > s ? "bg-primary-500" : "bg-white/10"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="glass p-8">
          {/* ── STEP 1: Role Selection ───────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">Choose your role</h2>
              {firebaseUser?.displayName && (
                <p className="text-white/40 text-sm mb-4">
                  Welcome, <span className="text-white/70 font-medium">{firebaseUser.displayName}</span>! Select how you'll use SocioSolve-AI.
                </p>
              )}
              {!firebaseUser?.displayName && (
                <p className="text-white/40 text-sm mb-4">
                  Select the role that best describes you.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 mb-6">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    id={`complete-role-${r.value}`}
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

              {/* Approval notice for org roles */}
              {(selectedRole === "university" || selectedRole === "industry") && (
                <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-300">
                  ⚠️ This role requires <strong>admin approval</strong> before you gain full access.
                </div>
              )}

              <button
                id="complete-profile-next"
                type="button"
                onClick={handleStep1}
                disabled={!selectedRole || loading}
                className="btn-primary w-full"
              >
                {loading
                  ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : needsOrg
                    ? <><span>Next</span><ChevronRight size={18} /></>
                    : <><UserPlus size={18} /> Complete Profile</>}
              </button>
            </>
          )}

          {/* ── STEP 2: Organization Details ─────────────────── */}
          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold text-white mb-1">Organization Details</h2>
              <p className="text-white/40 text-sm mb-6">
                Tell us about your {selectedRole === "university" ? "institution" : "company"}
              </p>

              <form onSubmit={onOrgSubmit} className="space-y-4">
                <div>
                  <label className="label">{selectedRole === "university" ? "Institution" : "Company"} Name *</label>
                  <input id="cp-org-name" className="input" placeholder="e.g. LUMS / TechCorp"
                    {...register("name")} />
                  {errors.name && <p className="error-text">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="label">Address</label>
                  <input id="cp-org-address" className="input" placeholder="City, Country"
                    {...register("address")} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input id="cp-org-website" className="input" placeholder="https://example.com"
                    {...register("website")} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea id="cp-org-desc" className="input resize-none h-20" placeholder="Brief description..."
                    {...register("description")} />
                </div>

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => setStep(1)} className="btn-ghost flex-1">
                    <ChevronLeft size={18} /> Back
                  </button>
                  <button
                    id="complete-profile-submit"
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1"
                  >
                    {loading
                      ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><UserPlus size={18} /> Create Profile</>}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
