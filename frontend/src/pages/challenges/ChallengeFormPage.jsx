import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Save,
  Send,
  Sparkles,
  AlertCircle,
  Tag,
  MapPin,
  Calendar,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import AttachmentDropzone from "../../components/challenges/AttachmentDropzone";
import challengeService from "../../services/challengeService";
import { useAuth } from "../../context/AuthContext";

export const CATEGORIES = [
  "Healthcare",
  "Education",
  "Agriculture",
  "Environment & Water",
  "Waste Management",
  "Smart Cities & Mobility",
  "Renewable Energy",
  "Other",
];

export const DIFFICULTIES = ["Easy", "Medium", "Hard"];

const INITIAL_FORM = {
  title: "",
  description: "",
  category: "Healthcare",
  location: "",
  difficulty: "Medium",
  expectedImpact: "",
  deadline: "",
  tagsInput: "",
  attachments: [],
};

export default function ChallengeFormPage() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState(null); // 'draft' | 'submitted'

  // Load existing challenge for editing
  useEffect(() => {
    if (!isEditMode) return;

    const loadChallenge = async () => {
      try {
        setLoading(true);
        const data = await challengeService.getChallengeById(id);

        // Security / permission check
        const isAuthor =
          user &&
          (data.authorId === user.id ||
            data.authorId === user._id ||
            data.createdBy === user.firebase_uid);
        const isAdmin = user?.role === "admin";

        if (!isAuthor && !isAdmin) {
          toast.error("You are not authorized to edit this challenge.");
          navigate(`/challenges/${id}`);
          return;
        }

        setForm({
          title: data.title || "",
          description: data.description || "",
          category: data.category || "Healthcare",
          location: data.location || "",
          difficulty: data.difficulty || "Medium",
          expectedImpact: data.expectedImpact || "",
          deadline: data.deadline ? data.deadline.substring(0, 10) : "",
          tagsInput: (data.tags || []).join(", "),
          attachments: data.attachments || [],
        });
      } catch (err) {
        console.error("Failed to load challenge for editing:", err);
        toast.error("Failed to load challenge data.");
        navigate("/challenges");
      } finally {
        setLoading(false);
      }
    };

    loadChallenge();
  }, [id, isEditMode, navigate, user]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) {
      errs.title = "Challenge title is required.";
    } else if (form.title.trim().length < 5) {
      errs.title = "Title must be at least 5 characters.";
    } else if (form.title.trim().length > 200) {
      errs.title = "Title cannot exceed 200 characters.";
    }

    if (!form.description.trim()) {
      errs.description = "Problem description is required.";
    } else if (form.description.trim().length < 20) {
      errs.description = "Description must be at least 20 characters.";
    } else if (form.description.trim().length > 10000) {
      errs.description = "Description cannot exceed 10,000 characters.";
    }

    if (!form.category) {
      errs.category = "Please select a societal category.";
    }

    if (!form.location.trim()) {
      errs.location = "Geographical location or city is required.";
    } else if (form.location.trim().length < 2) {
      errs.location = "Location must be at least 2 characters.";
    }

    if (form.expectedImpact && form.expectedImpact.length > 2000) {
      errs.expectedImpact = "Expected impact cannot exceed 2,000 characters.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRemoveExistingAttachment = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const handleSubmit = async (targetStatus) => {
    if (!validate()) {
      toast.error("Please resolve the validation errors before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmissionTarget(targetStatus);

    try {
      // 1. Upload newly staged files sequentially
      const newlyUploadedAttachments = [];
      for (const file of stagedFiles) {
        toast.loading(`Uploading attachment: ${file.name}...`, { id: "uploading-att" });
        const uploaded = await challengeService.uploadAttachment(file);
        newlyUploadedAttachments.push({
          name: uploaded.name || file.name,
          url: uploaded.url,
          fileType: uploaded.fileType || "document",
          sizeBytes: uploaded.sizeBytes || file.size,
        });
      }
      toast.dismiss("uploading-att");

      // Combine existing and newly uploaded attachments
      const allAttachments = [...form.attachments, ...newlyUploadedAttachments];

      // Parse tags
      const cleanedTags = form.tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
        .slice(0, 20);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        location: form.location.trim(),
        difficulty: form.difficulty,
        expectedImpact: form.expectedImpact.trim() || undefined,
        deadline: form.deadline ? form.deadline : undefined,
        tags: cleanedTags,
        attachments: allAttachments,
      };

      if (isEditMode) {
        await challengeService.updateChallenge(id, payload);
        toast.success("Challenge successfully updated!");
        navigate(`/challenges/${id}`);
      } else {
        payload.status = targetStatus === "draft" ? "draft" : "published";
        const created = await challengeService.createChallenge(payload);
        toast.success(
          targetStatus === "draft"
            ? "Challenge saved as draft!"
            : "Challenge published! It is now live and visible to all roles."
        );
        navigate(`/challenges/${created.id}`);
      }
    } catch (err) {
      console.error("Challenge submission failed:", err);
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d) => d.msg || d).join(", ")
        : detail || "Failed to save challenge. Please verify form details.";
      toast.error(message);
    } finally {
      setSubmitting(false);
      setSubmissionTarget(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="h-6 w-36 bg-white/5 rounded animate-pulse" />
          <div className="glass rounded-2xl border border-white/10 p-8 space-y-6 animate-pulse">
            <div className="h-8 w-1/2 bg-white/10 rounded" />
            <div className="space-y-4">
              <div className="h-10 w-full bg-white/5 rounded-xl" />
              <div className="h-32 w-full bg-white/5 rounded-xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl mx-auto pb-16">
        {/* Navigation & Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to={isEditMode ? `/challenges/${id}` : "/challenges"}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span>{isEditMode ? "Cancel and Back to Challenge" : "Back to Catalog"}</span>
          </Link>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-300 border border-primary-500/20">
            <Sparkles size={13} />
            <span>{isEditMode ? "Editing Societal Challenge" : "New Community Problem"}</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="glass rounded-2xl border border-white/10 p-6 md:p-8 space-y-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {isEditMode ? "Edit Societal Challenge" : "Submit a Societal Challenge"}
            </h1>
            <p className="text-sm text-slate-300 mt-1">
              Provide thorough problem details to help researchers, university teams, and developers
              design viable technical proposals.
            </p>
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>
                  Challenge Title <span className="text-rose-400">*</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {form.title.length}/200
                </span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="e.g., Contaminated Drinking Water Supply in Rural Vidarbha"
                maxLength={200}
                className={`w-full rounded-xl bg-white/5 border px-4 py-3 text-sm text-white focus:outline-none transition-colors ${
                  errors.title
                    ? "border-rose-500/80 focus:border-rose-500"
                    : "border-white/10 focus:border-primary-500"
                }`}
              />
              {errors.title && (
                <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle size={13} />
                  <span>{errors.title}</span>
                </p>
              )}
            </div>

            {/* Category & Location Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <span>Societal Domain Category</span>
                  <span className="text-rose-400">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-slate-900">
                      {cat}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="text-xs text-rose-400">{errors.category}</p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <span>Geographical Location / City</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <MapPin
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    placeholder="e.g., Pune, Maharashtra / Rural District"
                    className={`w-full rounded-xl bg-white/5 border pl-10 pr-4 py-3 text-sm text-white focus:outline-none transition-colors ${
                      errors.location
                        ? "border-rose-500/80 focus:border-rose-500"
                        : "border-white/10 focus:border-primary-500"
                    }`}
                  />
                </div>
                {errors.location && (
                  <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                    <AlertCircle size={13} />
                    <span>{errors.location}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Difficulty & Target Deadline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Difficulty */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Estimated Complexity Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTIES.map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => handleChange("difficulty", diff)}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                        form.difficulty === diff
                          ? "bg-primary-500/20 text-primary-300 border-primary-500 shadow-md shadow-primary-500/10"
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                  <span>Resolution Target Date (Optional)</span>
                  <span className="text-[11px] text-slate-400 font-normal">Optional</span>
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => handleChange("deadline", e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>
                  Detailed Problem Description <span className="text-rose-400">*</span>
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {form.description.length}/10,000 (min 20)
                </span>
              </label>
              <textarea
                rows={6}
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe the background, real-world symptoms, affected community populations, current failed attempts or gaps, and why an automated or technological solution is urgently required..."
                className={`w-full rounded-xl bg-white/5 border p-4 text-sm text-white focus:outline-none transition-colors ${
                  errors.description
                    ? "border-rose-500/80 focus:border-rose-500"
                    : "border-white/10 focus:border-primary-500"
                }`}
              />
              {errors.description && (
                <p className="text-xs text-rose-400 flex items-center gap-1 mt-1">
                  <AlertCircle size={13} />
                  <span>{errors.description}</span>
                </p>
              )}
            </div>

            {/* Expected Impact */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Expected Societal & Community Impact</span>
                <span className="text-[11px] text-slate-400 font-normal">Optional</span>
              </label>
              <textarea
                rows={3}
                value={form.expectedImpact}
                onChange={(e) => handleChange("expectedImpact", e.target.value)}
                placeholder="What tangible benefits, metrics, or outcomes will a successful solution deliver to the community?"
                maxLength={2000}
                className="w-full rounded-xl bg-white/5 border border-white/10 p-4 text-sm text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            {/* Keywords / Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Keywords & Tags</span>
                <span className="text-[11px] text-slate-400 font-normal">Comma-separated</span>
              </label>
              <div className="relative">
                <Tag
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={form.tagsInput}
                  onChange={(e) => handleChange("tagsInput", e.target.value)}
                  placeholder="e.g. water quality, sensors, iot, rural development"
                  className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            {/* Attachments Section */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Supporting Documents & Photos
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Attach field photos, preliminary survey reports, or data sheets (Max 5 files, 10 MB each).
                </p>
              </div>

              <AttachmentDropzone
                stagedFiles={stagedFiles}
                onFilesChange={setStagedFiles}
                existingAttachments={form.attachments}
                onRemoveExisting={handleRemoveExistingAttachment}
                disabled={submitting}
                maxFiles={5}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link
                to={isEditMode ? `/challenges/${id}` : "/challenges"}
                className="btn-ghost w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-medium border border-white/10 text-slate-300 hover:bg-white/5 text-center"
              >
                Cancel
              </Link>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => handleSubmit("draft")}
                    disabled={submitting}
                    className="btn-ghost w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold border border-white/10 hover:bg-white/5 text-slate-200 disabled:opacity-50"
                  >
                    <Save size={16} />
                    <span>
                      {submitting && submissionTarget === "draft" ? "Saving..." : "Save as Draft"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSubmit(isEditMode ? undefined : "published")}
                  disabled={submitting}
                  className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-primary-500/25 hover:shadow-primary-500/35 disabled:opacity-50"
                >
                  <Send size={16} />
                  <span>
                    {submitting && submissionTarget !== "draft"
                      ? isEditMode
                        ? "Saving Changes..."
                        : "Publishing Challenge..."
                      : isEditMode
                      ? "Save Changes"
                      : "Publish Challenge"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
