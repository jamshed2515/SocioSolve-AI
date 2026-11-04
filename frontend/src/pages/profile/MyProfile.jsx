import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import authService from "../../services/authService";
import toast from "react-hot-toast";
import {
  User, Mail, Phone, Building2, Globe, MapPin,
  Edit3, Camera, Tag, Calendar, CheckCircle2, XCircle,
} from "lucide-react";

export default function MyProfile() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    authService.getProfile()
      .then(r => setProfile(r.data))
      .catch(() => toast.error("Failed to load profile"));
  }, []);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await authService.uploadProfileImage(fd);
      toast.success("Profile photo updated!");
      setProfile(p => ({ ...p, profileImage: res.data.profileImageUrl }));
      updateUser({ profileImage: res.data.profileImageUrl });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const ROLE_GRADIENT = {
    citizen: "from-blue-500 to-cyan-500", student: "from-violet-500 to-purple-500",
    university: "from-amber-500 to-orange-500", industry: "from-emerald-500 to-teal-500",
    admin: "from-rose-500 to-pink-500",
  };
  const gradient = ROLE_GRADIENT[user?.role] || "from-primary-500 to-accent-400";

  if (!profile) return (
    <DashboardLayout title="My Profile">
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout title="My Profile">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Avatar + name card */}
        <div className="glass p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-3xl font-bold text-white overflow-hidden`}>
                {profile.profileImage
                  ? <img src={`http://localhost:8000${profile.profileImage}`} alt="avatar" className="w-full h-full object-cover" />
                  : profile.name?.[0]?.toUpperCase()}
              </div>
              <button
                onClick={() => fileRef.current.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-600
                  flex items-center justify-center transition shadow-lg shadow-primary-500/40">
                {uploading
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Camera size={14} className="text-white" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Name + role + status */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
              <p className="text-white/50 text-sm mt-1">{profile.email}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <span className="badge bg-primary-500/20 text-primary-300 capitalize">{profile.role}</span>
                {profile.isVerified
                  ? <span className="badge bg-green-500/20 text-green-300 flex items-center gap-1"><CheckCircle2 size={12} />Verified</span>
                  : <span className="badge bg-yellow-500/20 text-yellow-300 flex items-center gap-1"><XCircle size={12} />Unverified</span>}
                {profile.isActive
                  ? <span className="badge bg-emerald-500/20 text-emerald-300">Active</span>
                  : <span className="badge bg-red-500/20 text-red-300">Inactive</span>}
              </div>
            </div>

            <Link to="/profile/edit" id="edit-profile-btn" className="btn-primary text-sm flex-shrink-0">
              <Edit3 size={16} /> Edit Profile
            </Link>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="glass p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Contact Info</h3>
            <InfoRow icon={Mail}  label="Email"  value={profile.email} />
            <InfoRow icon={Phone} label="Phone"  value={profile.phone || "—"} />
            <InfoRow icon={Calendar} label="Joined" value={new Date(profile.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })} />
          </div>

          {profile.organization?.name && (
            <div className="glass p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Organization</h3>
              <InfoRow icon={Building2} label="Name"    value={profile.organization.name} />
              <InfoRow icon={MapPin}    label="Address" value={profile.organization.address || "—"} />
              <InfoRow icon={Globe}     label="Website" value={profile.organization.website || "—"} />
            </div>
          )}
        </div>

        {/* Skills */}
        {profile.skills?.length > 0 && (
          <div className="glass p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map(s => (
                <span key={s} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 text-sm border border-primary-500/20">
                  <Tag size={12} /> {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interests */}
        {profile.interests?.length > 0 && (
          <div className="glass p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Interests</h3>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map(i => (
                <span key={i} className="px-3 py-1 rounded-full bg-accent-400/10 text-accent-400 text-sm border border-accent-400/20">{i}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-white/40" />
      </div>
      <div>
        <p className="text-xs text-white/40">{label}</p>
        <p className="text-sm text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}
