import { useState } from "react";
import { X, Send, Users, Building2, Gift, Info } from "lucide-react";
import toast from "react-hot-toast";
import partnershipService from "../../services/partnershipService";

export default function ApplyOpportunityModal({ isOpen, onClose, opportunity, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [message, setMessage] = useState("");

  if (!isOpen || !opportunity) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (teamName.trim().length < 2) {
      return toast.error("Please enter a valid team name (at least 2 characters).");
    }
    if (message.trim().length < 20) {
      return toast.error("Please explain your project and why your team is applying (at least 20 characters).");
    }

    setLoading(true);
    try {
      const payload = {
        teamName: teamName.trim(),
        message: message.trim(),
      };
      const res = await partnershipService.applyToOpportunity(opportunity.id, payload);
      toast.success("Application submitted successfully! The industry partner has been notified. 🚀");
      if (onApplied) onApplied(res.data);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg glass p-6 sm:p-8 relative my-8 border-violet-500/30">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-white/50 hover:text-white transition"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Apply as Student Team</h2>
            <p className="text-xs text-white/50">Submit your pitch to collaborate with this industry partner</p>
          </div>
        </div>

        {/* Opportunity Summary Card */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white text-sm truncate">{opportunity.title}</span>
            <span className="badge bg-emerald-500/20 text-emerald-300">{opportunity.type}</span>
          </div>
          <p className="text-white/60 flex items-center gap-1.5">
            <Building2 size={13} className="text-primary-400" />
            {opportunity.organizationName}
          </p>
          {opportunity.resourcesOffered?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {opportunity.resourcesOffered.map((res, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 text-white/70 text-[11px]">
                  {res}
                </span>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Name */}
          <div>
            <label className="label">Team Name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. EcoInnovators, SolarGrid Alpha"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
            />
            <p className="text-[11px] text-white/40 mt-1 flex items-center gap-1">
              <Info size={12} /> Enter your student project team name. Once Module 3 is released, your official team profile will link here automatically.
            </p>
          </div>

          {/* Message / Pitch */}
          <div>
            <label className="label">Application Message & Pitch *</label>
            <textarea
              rows={4}
              className="input resize-none"
              placeholder="Tell the industry partner about your challenge solution, current prototype or idea, and how this opportunity will accelerate your project..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-ghost text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-sm bg-violet-600 hover:bg-violet-500 flex items-center gap-2"
            >
              {loading ? (
                "Submitting..."
              ) : (
                <>
                  <Send size={15} /> Submit Application
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

