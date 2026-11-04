import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import authService from "../../services/authService";
import toast from "react-hot-toast";
import { Save, Plus, X, KeyRound, Eye, EyeOff } from "lucide-react";

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setSaving]  = useState(false);
  const [profile, setProfile] = useState(null);
  const [form, setForm]       = useState({ name: "", phone: "", skills: [], interests: [], organization: {} });
  const [newSkill, setNewSkill]       = useState("");
  const [newInterest, setNewInterest] = useState("");

  /* Change password state */
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    authService.getProfile().then(r => {
      const p = r.data;
      setProfile(p);
      setForm({
        name:         p.name || "",
        phone:        p.phone || "",
        skills:       p.skills || [],
        interests:    p.interests || [],
        organization: p.organization || {},
      });
    }).catch(() => toast.error("Could not load profile"));
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setOrg = (k) => (e) => setForm(f => ({ ...f, organization: { ...f.organization, [k]: e.target.value } }));

  const addTag = (type, value, setter) => {
    const v = value.trim();
    if (!v) return;
    setForm(f => ({ ...f, [type]: [...f[type], v] }));
    setter("");
  };
  const removeTag = (type, idx) => setForm(f => ({ ...f, [type]: f[type].filter((_, i) => i !== idx) }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authService.updateProfile({
        name:         form.name,
        phone:        form.phone || undefined,
        skills:       form.skills,
        interests:    form.interests,
        organization: Object.keys(form.organization).length ? form.organization : undefined,
      });
      updateUser({ name: form.name });
      toast.success("Profile updated!");
      navigate("/profile");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePwdChange = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return toast.error("Passwords don't match");
    setPwdLoading(true);
    try {
      await authService.changePassword(pwdForm);
      toast.success("Password changed! Please log in again.");
      navigate("/login");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Password change failed");
    } finally {
      setPwdLoading(false);
    }
  };

  const needsOrg = ["university", "industry"].includes(user?.role);

  if (!profile) return (
    <DashboardLayout title="Edit Profile">
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout title="Edit Profile">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* ── Basic Info ──────────────────────────────────────── */}
        <form onSubmit={handleSave} className="glass p-6 space-y-5">
          <h3 className="text-base font-semibold text-white">Basic Information</h3>

          <div>
            <label className="label">Full Name</label>
            <input id="edit-name" className="input" value={form.name} onChange={set("name")} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input id="edit-phone" className="input" placeholder="+92 300 0000000" value={form.phone} onChange={set("phone")} />
          </div>

          {/* Organization */}
          {needsOrg && (
            <>
              <h3 className="text-base font-semibold text-white pt-2 border-t border-white/5">
                Organization Details
              </h3>
              <div>
                <label className="label">{user.role === "university" ? "Institution" : "Company"} Name</label>
                <input id="edit-org-name" className="input" value={form.organization.name || ""} onChange={setOrg("name")} />
              </div>
              <div>
                <label className="label">Address</label>
                <input id="edit-org-address" className="input" value={form.organization.address || ""} onChange={setOrg("address")} />
              </div>
              <div>
                <label className="label">Website</label>
                <input id="edit-org-website" className="input" placeholder="https://" value={form.organization.website || ""} onChange={setOrg("website")} />
              </div>
            </>
          )}

          {/* Skills */}
          <div>
            <label className="label">Skills</label>
            <div className="flex gap-2 mb-2">
              <input id="edit-skill-input" className="input text-sm" placeholder="e.g. Python"
                value={newSkill} onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag("skills", newSkill, setNewSkill))} />
              <button type="button" onClick={() => addTag("skills", newSkill, setNewSkill)} className="btn-ghost px-4 py-2 text-sm">
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.skills.map((s, i) => (
                <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 text-sm border border-primary-500/20">
                  {s}
                  <button type="button" onClick={() => removeTag("skills", i)} className="hover:text-red-400 transition">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="label">Interests</label>
            <div className="flex gap-2 mb-2">
              <input id="edit-interest-input" className="input text-sm" placeholder="e.g. AI, Climate"
                value={newInterest} onChange={e => setNewInterest(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag("interests", newInterest, setNewInterest))} />
              <button type="button" onClick={() => addTag("interests", newInterest, setNewInterest)} className="btn-ghost px-4 py-2 text-sm">
                <Plus size={16} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.interests.map((interest, i) => (
                <span key={i} className="flex items-center gap-1 px-3 py-1 rounded-full bg-accent-400/10 text-accent-400 text-sm border border-accent-400/20">
                  {interest}
                  <button type="button" onClick={() => removeTag("interests", i)} className="hover:text-red-400 transition">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <button id="save-profile-btn" type="submit" disabled={loading} className="btn-primary w-full">
            {loading
              ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><Save size={18} /> Save Changes</>}
          </button>
        </form>

        {/* ── Change Password ──────────────────────────────────── */}
        <form onSubmit={handlePwdChange} className="glass p-6 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <KeyRound size={16} className="text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white">Change Password</h3>
          </div>

          {["currentPassword", "newPassword", "confirmPassword"].map((field, i) => (
            <div key={field}>
              <label className="label">{["Current Password", "New Password", "Confirm New Password"][i]}</label>
              <div className="relative">
                <input id={`pwd-${field}`} type={showPwd ? "text" : "password"} className="input pr-11"
                  placeholder="••••••••"
                  value={pwdForm[field]}
                  onChange={e => setPwdForm(p => ({ ...p, [field]: e.target.value }))} />
                {i === 0 && (
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          <button id="change-password-btn" type="submit" disabled={pwdLoading}
            className="w-full px-6 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold border border-red-500/20 transition flex items-center justify-center gap-2">
            {pwdLoading
              ? <span className="w-5 h-5 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
              : <><KeyRound size={18} /> Update Password</>}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
