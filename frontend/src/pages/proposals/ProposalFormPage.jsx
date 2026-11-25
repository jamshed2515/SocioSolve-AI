import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Save,
  Send,
  Plus,
  Trash2,
  Upload,
  Link as LinkIcon,
  FileText,
  Users,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import proposalService from "../../services/proposalService";

const INITIAL_FORM = {
  title: "",
  challengeId: "",
  problemUnderstanding: "",
  proposedSolution: "",
  innovationUniqueness: "",
  technicalApproach: "",
  implementationPlan: "",
  requiredResources: "",
  expectedImpact: "",
  estimatedTimeline: "",
  teamId: "",
  teamName: "",
  teamMembers: [],
  prototypeUrl: "",
  githubUrl: "",
  demoUrl: "",
  supportingDocuments: [],
  additionalNotes: "",
};

export default function ProposalFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [challenges, setChallenges] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Temporary state for adding a team member or external document link
  const [newMember, setNewMember] = useState({ name: "", email: "", roleInTeam: "Developer / Researcher" });
  const [newDocLink, setNewDocLink] = useState({ name: "", url: "", docType: "implementation_plan" });

  useEffect(() => {
    const initForm = async () => {
      try {
        setLoading(true);
        const [challengesRes, teamsRes] = await Promise.all([
          proposalService.getPublishedChallenges(),
          proposalService.getMyTeams().catch(() => ({ teams: [] })),
        ]);
        const pubChallenges = challengesRes.challenges || [];
        setChallenges(pubChallenges);
        setTeams(teamsRes.teams || []);

        if (isEditMode) {
          const existing = await proposalService.getProposalById(id);
          if (existing.status !== "draft" && existing.status !== "withdrawn") {
            toast.error("Only draft or withdrawn proposals can be edited.");
            navigate(`/proposals/${id}`);
            return;
          }
          setForm({
            title: existing.title || "",
            challengeId: existing.challengeId || "",
            problemUnderstanding: existing.problemUnderstanding || "",
            proposedSolution: existing.proposedSolution || "",
            innovationUniqueness: existing.innovationUniqueness || "",
            technicalApproach: existing.technicalApproach || "",
            implementationPlan: existing.implementationPlan || "",
            requiredResources: existing.requiredResources || "",
            expectedImpact: existing.expectedImpact || "",
            estimatedTimeline: existing.estimatedTimeline || "",
            teamId: existing.teamId || "",
            teamName: existing.teamName || "",
            teamMembers: existing.teamMembers || [],
            prototypeUrl: existing.prototypeUrl || "",
            githubUrl: existing.githubUrl || "",
            demoUrl: existing.demoUrl || "",
            supportingDocuments: existing.supportingDocuments || [],
            additionalNotes: existing.additionalNotes || "",
          });
        } else {
          const preselectedChallenge = searchParams.get("challengeId");
          if (preselectedChallenge) {
            setForm((prev) => ({ ...prev, challengeId: preselectedChallenge }));
          } else if (pubChallenges.length > 0) {
            setForm((prev) => ({ ...prev, challengeId: pubChallenges[0].id }));
          }
        }
      } catch (err) {
        toast.error(err.response?.data?.detail || "Failed to load proposal form data.");
      } finally {
        setLoading(false);
      }
    };
    initForm();
  }, [id, isEditMode, navigate, searchParams]);

  const selectedChallenge = challenges.find((c) => c.id === form.challengeId);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSelectExistingTeam = (teamIdVal) => {
    const found = teams.find((t) => t.id === teamIdVal);
    if (found) {
      setForm((prev) => ({
        ...prev,
        teamId: found.id,
        teamName: found.name || prev.teamName,
        teamMembers: found.members || prev.teamMembers,
      }));
    } else {
      setForm((prev) => ({ ...prev, teamId: "" }));
    }
  };

  const handleAddTeamMember = () => {
    if (!newMember.name.trim()) {
      toast.error("Please enter the team member's name.");
      return;
    }
    setForm((prev) => ({
      ...prev,
      teamMembers: [
        ...prev.teamMembers,
        {
          name: newMember.name.trim(),
          email: newMember.email.trim(),
          roleInTeam: newMember.roleInTeam.trim() || "Member",
        },
      ],
    }));
    setNewMember({ name: "", email: "", roleInTeam: "Developer / Researcher" });
  };

  const handleRemoveTeamMember = (idx) => {
    setForm((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.filter((_, i) => i !== idx),
    }));
  };

  const handleAddDocumentLink = () => {
    if (!newDocLink.name.trim() || !newDocLink.url.trim()) {
      toast.error("Please provide both a document title and a valid URL.");
      return;
    }
    if (!newDocLink.url.startsWith("http://") && !newDocLink.url.startsWith("https://")) {
      toast.error("Document URL must start with http:// or https://");
      return;
    }
    setForm((prev) => ({
      ...prev,
      supportingDocuments: [
        ...prev.supportingDocuments,
        {
          name: newDocLink.name.trim(),
          url: newDocLink.url.trim(),
          docType: newDocLink.docType,
        },
      ],
    }));
    setNewDocLink({ name: "", url: "", docType: "implementation_plan" });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingFile(true);
      const uploaded = await proposalService.uploadDocument(file, "implementation_plan");
      setForm((prev) => ({
        ...prev,
        supportingDocuments: [...prev.supportingDocuments, uploaded],
      }));
      toast.success(`Uploaded "${uploaded.name}"`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "File upload failed.");
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleRemoveDocument = (idx) => {
    setForm((prev) => ({
      ...prev,
      supportingDocuments: prev.supportingDocuments.filter((_, i) => i !== idx),
    }));
  };

  const validateForm = (isFinalSubmit) => {
    const newErrors = {};
    if (!form.title || form.title.trim().length < 3) {
      newErrors.title = "Proposal title must be at least 3 characters.";
    }
    if (!form.challengeId) {
      newErrors.challengeId = "Please select a published societal challenge.";
    }

    const urlFields = ["prototypeUrl", "githubUrl", "demoUrl"];
    urlFields.forEach((key) => {
      const val = (form[key] || "").trim();
      if (val && !val.startsWith("http://") && !val.startsWith("https://")) {
        newErrors[key] = "URL must start with http:// or https://";
      }
    });

    if (isFinalSubmit) {
      const detailedFields = [
        ["problemUnderstanding", "Problem understanding", 20],
        ["proposedSolution", "Proposed solution", 20],
        ["innovationUniqueness", "Innovation / uniqueness", 10],
        ["technicalApproach", "Technical approach", 20],
        ["implementationPlan", "Implementation plan", 20],
        ["requiredResources", "Required resources", 5],
        ["expectedImpact", "Expected impact", 10],
        ["estimatedTimeline", "Estimated implementation timeline", 5],
      ];

      detailedFields.forEach(([key, label, minLen]) => {
        const val = (form[key] || "").trim();
        if (!val) {
          newErrors[key] = `${label} is required for final submission.`;
        } else if (val.length < minLen) {
          newErrors[key] = `${label} must be at least ${minLen} characters.`;
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveAsDraft = async () => {
    if (!validateForm(false)) {
      toast.error("Please fix the highlighted validation errors before saving draft.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        prototypeUrl: form.prototypeUrl.trim() || null,
        githubUrl: form.githubUrl.trim() || null,
        demoUrl: form.demoUrl.trim() || null,
        submitImmediately: false,
      };

      if (isEditMode) {
        const updated = await proposalService.updateProposal(id, payload);
        toast.success("Draft updated successfully!");
        navigate(`/proposals/${updated.id}`);
      } else {
        const created = await proposalService.createProposal(payload);
        toast.success("Proposal saved as draft!");
        navigate(`/proposals/${created.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save draft.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSubmitConfirmation = () => {
    if (!validateForm(true)) {
      toast.error("Please complete all required fields before submitting.");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmFinalSubmission = async () => {
    try {
      setSubmitting(true);
      const payload = {
        ...form,
        prototypeUrl: form.prototypeUrl.trim() || null,
        githubUrl: form.githubUrl.trim() || null,
        demoUrl: form.demoUrl.trim() || null,
        submitImmediately: true,
      };

      if (isEditMode) {
        await proposalService.updateProposal(id, payload);
        const submitted = await proposalService.submitProposal(id);
        toast.success("Proposal officially submitted for evaluation!");
        setShowConfirmModal(false);
        navigate(`/proposals/${submitted.id}`);
      } else {
        const created = await proposalService.createProposal(payload);
        toast.success("Proposal officially submitted for evaluation!");
        setShowConfirmModal(false);
        navigate(`/proposals/${created.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to submit proposal.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={isEditMode ? "Edit Draft Proposal" : "Create Solution Proposal"}>
        <div className="space-y-4">
          <div className="glass h-32 animate-pulse" />
          <div className="glass h-96 animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={isEditMode ? "Edit Draft Proposal" : "Create Solution Proposal"}>
      <div className="max-w-5xl mx-auto">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Link
              to="/proposals"
              className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-2"
            >
              <ArrowLeft size={14} /> Back to Proposals Dashboard
            </Link>
            <h2 className="text-xl font-bold text-white">
              {isEditMode ? "Edit Draft Solution Proposal" : "Submit a Solution Proposal"}
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              Select a published societal challenge, outline your technical & implementation plan, and attach prototype or document links.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveAsDraft}
              className="btn-ghost text-xs px-4 py-2.5"
            >
              <Save size={15} /> Save as Draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleOpenSubmitConfirmation}
              className="btn-primary text-xs px-5 py-2.5"
            >
              <Send size={15} /> Submit Proposal
            </button>
          </div>
        </div>

        {/* Section 1: Browse Published Challenges & Proposal Title */}
        <div className="glass p-6 mb-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Lightbulb size={18} className="text-primary-400" />
            <h3 className="text-base font-semibold text-white">
              1. Challenge Selection & Proposal Identity
            </h3>
          </div>

          <div>
            <label className="label">
              Related Published Societal Challenge <span className="text-rose-400">*</span>
            </label>
            <select
              value={form.challengeId}
              onChange={(e) => handleChange("challengeId", e.target.value)}
              className="input text-sm"
            >
              <option value="">-- Select a published societal challenge --</option>
              {challenges.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  [{ch.category}] {ch.title} ({ch.location || "National"})
                </option>
              ))}
            </select>
            {errors.challengeId && <p className="error-text">{errors.challengeId}</p>}
          </div>

          {/* Selected Challenge Preview Card */}
          {selectedChallenge && (
            <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/25 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge bg-primary-500/20 text-primary-300">
                  {selectedChallenge.category}
                </span>
                <div className="flex items-center gap-4 text-xs text-white/60">
                  {selectedChallenge.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {selectedChallenge.location}
                    </span>
                  )}
                  {selectedChallenge.deadline && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} /> Deadline: {selectedChallenge.deadline}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm font-semibold text-white">{selectedChallenge.title}</p>
              <p className="text-xs text-white/70 leading-relaxed">
                {selectedChallenge.description}
              </p>
              {selectedChallenge.expectedImpact && (
                <p className="text-xs text-accent-400 font-medium">
                  Target Impact: {selectedChallenge.expectedImpact}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="label">
              Proposal Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="e.g., HydroSense AI: Solar-Powered Edge IoT Water Contamination Alert Network"
              className="input text-sm"
            />
            {errors.title && <p className="error-text">{errors.title}</p>}
          </div>
        </div>

        {/* Section 2: Problem Understanding, Solution & Innovation */}
        <div className="glass p-6 mb-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <FileText size={18} className="text-primary-400" />
            <h3 className="text-base font-semibold text-white">
              2. Problem Understanding & Proposed Solution
            </h3>
          </div>

          <div>
            <label className="label">
              Problem Understanding & Root Cause Analysis <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={form.problemUnderstanding}
              onChange={(e) => handleChange("problemUnderstanding", e.target.value)}
              placeholder="Describe the core societal problem, affected stakeholders, and current gaps in existing solutions..."
              className="input text-sm"
            />
            {errors.problemUnderstanding && (
              <p className="error-text">{errors.problemUnderstanding}</p>
            )}
          </div>

          <div>
            <label className="label">
              Proposed Solution Overview <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={form.proposedSolution}
              onChange={(e) => handleChange("proposedSolution", e.target.value)}
              placeholder="Explain your end-to-end solution clearly, how users interact with it, and how it resolves the challenge..."
              className="input text-sm"
            />
            {errors.proposedSolution && (
              <p className="error-text">{errors.proposedSolution}</p>
            )}
          </div>

          <div>
            <label className="label">
              Innovation & Uniqueness <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={form.innovationUniqueness}
              onChange={(e) => handleChange("innovationUniqueness", e.target.value)}
              placeholder="What makes your approach novel, cost-effective, or uniquely adaptable compared to conventional alternatives?"
              className="input text-sm"
            />
            {errors.innovationUniqueness && (
              <p className="error-text">{errors.innovationUniqueness}</p>
            )}
          </div>
        </div>

        {/* Section 3: Technical Architecture, Implementation Plan, Resources & Impact */}
        <div className="glass p-6 mb-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <CheckCircle2 size={18} className="text-accent-400" />
            <h3 className="text-base font-semibold text-white">
              3. Technical Approach, Implementation Plan & Impact
            </h3>
          </div>

          <div>
            <label className="label">
              Technical Approach & Architecture <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={form.technicalApproach}
              onChange={(e) => handleChange("technicalApproach", e.target.value)}
              placeholder="Detail your technology stack, AI/ML models, hardware/software components, data flow, and security considerations..."
              className="input text-sm"
            />
            {errors.technicalApproach && (
              <p className="error-text">{errors.technicalApproach}</p>
            )}
          </div>

          <div>
            <label className="label">
              Step-by-Step Implementation Plan <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={4}
              value={form.implementationPlan}
              onChange={(e) => handleChange("implementationPlan", e.target.value)}
              placeholder="Outline phases (Phase 1: Research & Prototype, Phase 2: Field Pilot, Phase 3: Deployment & Handover), deliverables, and testing strategy..."
              className="input text-sm"
            />
            {errors.implementationPlan && (
              <p className="error-text">{errors.implementationPlan}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">
                Estimated Implementation Timeline <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={form.estimatedTimeline}
                onChange={(e) => handleChange("estimatedTimeline", e.target.value)}
                placeholder="e.g., 12 Weeks (Weeks 1-4 MVP, Weeks 5-8 Field Testing, Weeks 9-12 Scale)"
                className="input text-sm"
              />
              {errors.estimatedTimeline && (
                <p className="error-text">{errors.estimatedTimeline}</p>
              )}
            </div>

            <div>
              <label className="label">
                Required Resources & Support <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={form.requiredResources}
                onChange={(e) => handleChange("requiredResources", e.target.value)}
                placeholder="e.g., Cloud GPU credits, water lab access, ₹45,000 sensor kit, industry mentor"
                className="input text-sm"
              />
              {errors.requiredResources && (
                <p className="error-text">{errors.requiredResources}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">
              Expected Societal Impact & Measurable KPIs <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={form.expectedImpact}
              onChange={(e) => handleChange("expectedImpact", e.target.value)}
              placeholder="Quantify the expected community benefit, number of beneficiaries, cost savings, or environmental improvement..."
              className="input text-sm"
            />
            {errors.expectedImpact && <p className="error-text">{errors.expectedImpact}</p>}
          </div>
        </div>

        {/* Section 4: Team Information (Module 3 Integration) */}
        <div className="glass p-6 mb-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <Users size={18} className="text-violet-400" />
            <h3 className="text-base font-semibold text-white">
              4. Team & Collaboration Details
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teams.length > 0 && (
              <div>
                <label className="label">Link Existing Project Team (Module 3)</label>
                <select
                  value={form.teamId}
                  onChange={(e) => handleSelectExistingTeam(e.target.value)}
                  className="input text-sm"
                >
                  <option value="">-- Individual / Custom Team --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={teams.length > 0 ? "" : "md:col-span-2"}>
              <label className="label">Team / University Lab Name (Optional)</label>
              <input
                type="text"
                value={form.teamName}
                onChange={(e) => handleChange("teamName", e.target.value)}
                placeholder="e.g., Team EcoInnovators – IIT/NIT Civic Tech Lab"
                className="input text-sm"
              />
            </div>
          </div>

          {/* Add Team Member Rows */}
          <div>
            <label className="label">Co-Authors & Team Members</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
              <input
                type="text"
                value={newMember.name}
                onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                placeholder="Member Name"
                className="input py-2 text-xs"
              />
              <input
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                placeholder="Member Email (optional)"
                className="input py-2 text-xs"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMember.roleInTeam}
                  onChange={(e) => setNewMember((p) => ({ ...p, roleInTeam: e.target.value }))}
                  placeholder="Role (e.g. ML Lead)"
                  className="input py-2 text-xs flex-1"
                />
                <button
                  type="button"
                  onClick={handleAddTeamMember}
                  className="btn-ghost px-3 py-2 text-xs shrink-0"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {form.teamMembers.length > 0 && (
              <div className="space-y-2">
                {form.teamMembers.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-white">{m.name}</span>
                      {m.email && <span className="text-white/50 ml-2">({m.email})</span>}
                      <span className="badge bg-violet-500/20 text-violet-300 ml-2 text-[10px]">
                        {m.roleInTeam || "Member"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeamMember(idx)}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Prototype Links, Supporting Documents & Notes */}
        <div className="glass p-6 mb-8 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
            <LinkIcon size={18} className="text-cyan-400" />
            <h3 className="text-base font-semibold text-white">
              5. Prototype Links, Implementation Documents & Attachments
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Prototype / Figma / CAD URL</label>
              <input
                type="url"
                value={form.prototypeUrl}
                onChange={(e) => handleChange("prototypeUrl", e.target.value)}
                placeholder="https://figma.com/file/..."
                className="input text-sm"
              />
              {errors.prototypeUrl && <p className="error-text">{errors.prototypeUrl}</p>}
            </div>

            <div>
              <label className="label">GitHub / Source Code Repository URL</label>
              <input
                type="url"
                value={form.githubUrl}
                onChange={(e) => handleChange("githubUrl", e.target.value)}
                placeholder="https://github.com/team/project"
                className="input text-sm"
              />
              {errors.githubUrl && <p className="error-text">{errors.githubUrl}</p>}
            </div>

            <div>
              <label className="label">Live Demo / Video Walkthrough URL</label>
              <input
                type="url"
                value={form.demoUrl}
                onChange={(e) => handleChange("demoUrl", e.target.value)}
                placeholder="https://youtu.be/... or live app URL"
                className="input text-sm"
              />
              {errors.demoUrl && <p className="error-text">{errors.demoUrl}</p>}
            </div>
          </div>

          {/* Supporting Documents: Upload or Add Link */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-white">
                  Supporting Documents & Implementation Plans
                </h4>
                <p className="text-xs text-white/50">
                  Upload PDF/DOCX/PPTX files (up to 10 MB) or attach external Google Drive / Notion document URLs.
                </p>
              </div>

              <label className="btn-ghost text-xs px-4 py-2 cursor-pointer self-start sm:self-auto">
                <Upload size={14} />
                {uploadingFile ? "Uploading..." : "Upload File"}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.zip"
                  className="hidden"
                />
              </label>
            </div>

            {/* External Document URL Input Row */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <input
                type="text"
                value={newDocLink.name}
                onChange={(e) => setNewDocLink((p) => ({ ...p, name: e.target.value }))}
                placeholder="Document Title (e.g. Architecture PDF)"
                className="input py-2 text-xs"
              />
              <input
                type="url"
                value={newDocLink.url}
                onChange={(e) => setNewDocLink((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://drive.google.com/..."
                className="input py-2 text-xs sm:col-span-2"
              />
              <div className="flex gap-2">
                <select
                  value={newDocLink.docType}
                  onChange={(e) => setNewDocLink((p) => ({ ...p, docType: e.target.value }))}
                  className="input py-2 text-xs flex-1"
                >
                  <option value="implementation_plan">Implementation Plan</option>
                  <option value="architecture">Technical Spec</option>
                  <option value="presentation">Pitch Deck</option>
                  <option value="supporting_document">Other Doc</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddDocumentLink}
                  className="btn-ghost px-3 py-2 text-xs shrink-0"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>

            {/* Attached Documents List */}
            {form.supportingDocuments.length > 0 && (
              <div className="space-y-2 pt-2">
                {form.supportingDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-dark-800 border border-white/10 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText size={15} className="text-primary-400 shrink-0" />
                      <div className="truncate">
                        <span className="font-medium text-white">{doc.name}</span>
                        <span className="badge bg-white/10 text-white/70 ml-2 text-[10px]">
                          {doc.docType}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(idx)}
                      className="text-rose-400 hover:text-rose-300 ml-3"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Optional Additional Notes</label>
            <textarea
              rows={2}
              value={form.additionalNotes}
              onChange={(e) => handleChange("additionalNotes", e.target.value)}
              placeholder="Any special assumptions, ethical considerations, or partnership requests..."
              className="input text-sm"
            />
          </div>

          {/* Bottom Form Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-white/10">
            <Link to="/proposals" className="btn-ghost text-xs px-5 py-2.5">
              Cancel
            </Link>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveAsDraft}
              className="btn-ghost text-xs px-5 py-2.5 border-primary-500/40 text-primary-300"
            >
              <Save size={15} /> Save as Draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleOpenSubmitConfirmation}
              className="btn-primary text-xs px-6 py-2.5"
            >
              <Send size={15} /> Submit Proposal for Evaluation
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal Before Final Submission */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass max-w-md w-full p-6 border-primary-500/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-primary-500/20 flex items-center justify-center">
                <AlertCircle className="text-primary-400" size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirm Final Proposal Submission
                </h3>
                <p className="text-xs text-white/50">
                  Controlled Evaluation Workflow
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1.5 mb-4">
              <p className="text-white font-semibold">{form.title}</p>
              <p className="text-white/60">
                Challenge: {selectedChallenge?.title}
              </p>
            </div>

            <p className="text-xs text-white/70 leading-relaxed mb-6">
              Are you ready to submit this proposal? Once submitted, the status changes to{" "}
              <span className="text-blue-300 font-semibold">Submitted</span>, silent editing is locked, and authorized reviewers will be notified to evaluate your solution.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="btn-ghost text-xs px-4 py-2"
              >
                Review Again
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleConfirmFinalSubmission}
                className="btn-primary text-xs px-5 py-2"
              >
                {submitting ? "Submitting..." : "Yes, Submit Proposal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
