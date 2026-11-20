import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Compass,
  Info,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { ChallengeOption, CreateTeamPayload } from "../types";

export default function CreateTeam() {
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maxMembers, setMaxMembers] = useState(6);

  // Challenges State
  const [challenges, setChallenges] = useState<ChallengeOption[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    teamApi
      .getChallenges()
      .then((data) => {
        if (active) {
          setChallenges(data);
          if (data.length > 0) {
            setChallengeId(data[0].id);
          }
        }
      })
      .catch(() => {
        if (active) {
          toast.error("Could not load challenges dynamically. Using defaults.");
        }
      })
      .finally(() => {
        if (active) setLoadingChallenges(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Team name is required.";
    } else if (name.trim().length < 2) {
      newErrors.name = "Team name must be at least 2 characters.";
    } else if (name.trim().length > 100) {
      newErrors.name = "Team name cannot exceed 100 characters.";
    }

    if (!description.trim()) {
      newErrors.description = "Team description is required.";
    } else if (description.trim().length < 5) {
      newErrors.description = "Description must be at least 5 characters.";
    } else if (description.trim().length > 1000) {
      newErrors.description = "Description cannot exceed 1000 characters.";
    }

    if (!challengeId) {
      newErrors.challengeId = "Please select an associated societal challenge.";
    }

    if (maxMembers < 2 || maxMembers > 20) {
      newErrors.maxMembers = "Maximum team members must be between 2 and 20.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload: CreateTeamPayload = {
        name: name.trim(),
        description: description.trim(),
        challenge_id: challengeId,
        max_members: Number(maxMembers),
      };

      const newTeam = await teamApi.createTeam(payload);
      toast.success(`Team '${newTeam.name}' formed successfully! 🎉`);
      navigate(`/teams/${newTeam.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to create team. Please verify your inputs.";
      toast.error(msg);
      setErrors({ form: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedChallenge = challenges.find((c) => c.id === challengeId);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Header Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/teams/my-teams"
          className="inline-flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white transition"
        >
          <ArrowLeft size={15} /> Back to My Teams
        </Link>
        <span className="badge bg-primary-500/15 text-primary-300 border border-primary-500/25">
          Phase 2 · Team Formation
        </span>
      </div>

      {/* Main Card */}
      <div className="glass p-6 sm:p-8 bg-dark-800/90 border-white/10 shadow-2xl">
        <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center text-primary-300 shrink-0">
            <Sparkles size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Form a New Innovation Team</h2>
            <p className="text-xs text-white/55 mt-0.5">
              Create a dedicated multidisciplinary team for a Jharkhand societal challenge.
            </p>
          </div>
        </div>

        {errors.form && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-3 text-xs text-red-200">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Name */}
          <div>
            <label className="label">
              Team Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. JalRakshak Jharkhand or GramShiksha AI"
              className="input text-sm"
              maxLength={100}
            />
            {errors.name ? (
              <p className="error-text">{errors.name}</p>
            ) : (
              <p className="text-[11px] text-white/40 mt-1">
                Choose a memorable name that reflects your team identity.
              </p>
            )}
          </div>

          {/* Associated Challenge (Dynamic Selection) */}
          <div>
            <label className="label flex items-center justify-between">
              <span>
                Associated Societal Challenge <span className="text-red-400">*</span>
              </span>
              {loadingChallenges && (
                <span className="text-xs text-white/40 inline-flex items-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> Loading challenges...
                </span>
              )}
            </label>
            <select
              value={challengeId}
              onChange={(e) => setChallengeId(e.target.value)}
              disabled={loadingChallenges}
              className="input text-sm bg-dark-700 text-white cursor-pointer"
            >
              {challenges.length === 0 && (
                <option value="">No published challenges found</option>
              )}
              {challenges.map((c) => (
                <option key={c.id} value={c.id} className="bg-dark-800 text-white py-1">
                  {c.title} ({c.category || "General"})
                </option>
              ))}
            </select>
            {errors.challengeId && <p className="error-text">{errors.challengeId}</p>}

            {/* Selected Challenge Context Card */}
            {selectedChallenge && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-start gap-3">
                <Compass size={16} className="text-accent-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white truncate">
                      {selectedChallenge.title}
                    </span>
                    <span className="badge text-[10px] bg-accent-400/15 text-accent-300">
                      {selectedChallenge.category}
                    </span>
                  </div>
                  {selectedChallenge.description && (
                    <p className="text-white/50 line-clamp-2">
                      {selectedChallenge.description}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Team Description */}
          <div>
            <label className="label">
              Team Mission & Description <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your team's objective, technical strategy, intended community impact, and the complementary skills you are looking for..."
              className="input text-sm resize-none"
              maxLength={1000}
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-white/40">
              {errors.description ? (
                <p className="error-text mt-0">{errors.description}</p>
              ) : (
                <span>Explain how your solution targets Jharkhand community problems.</span>
              )}
              <span>{description.length}/1000</span>
            </div>
          </div>

          {/* Maximum Team Capacity */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">
                Maximum Team Members <span className="text-red-400">*</span>
              </label>
              <span className="text-xs font-bold text-accent-400 px-2.5 py-0.5 rounded-full bg-accent-400/15 border border-accent-400/25">
                {maxMembers} Members
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={2}
                max={20}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="w-full accent-primary-500 cursor-pointer"
              />
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/70 shrink-0">
                Range: 2 – 20
              </span>
            </div>
            <p className="text-[11px] text-white/45 mt-1.5 flex items-center gap-1.5">
              <Users size={12} className="text-primary-400" />
              You will automatically be registered as the <strong>Team Leader</strong> upon creation.
            </p>
            {errors.maxMembers && <p className="error-text">{errors.maxMembers}</p>}
          </div>

          {/* Information Notice */}
          <div className="p-3.5 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-start gap-3 text-xs text-white/75">
            <Info size={16} className="text-primary-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-white">Team Formation Policy</p>
              <p className="text-white/60 leading-relaxed">
                As team leader, you will be able to manage team settings, invite collaborators, coordinate tasks, and submit solution proposals for evaluation.
              </p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate("/teams/my-teams")}
              className="btn-ghost text-xs px-5 py-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-6 py-3"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Creating Team...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Create Team
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
