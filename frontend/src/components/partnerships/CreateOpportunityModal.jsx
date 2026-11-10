import { useState } from "react";
import { X, Plus, Sparkles, Building2, Layers, Gift } from "lucide-react";
import toast from "react-hot-toast";
import partnershipService from "../../services/partnershipService";

const DEFAULT_CATEGORIES = [
  "Healthcare", "Environment", "Education", "Agriculture",
  "Clean Energy", "Smart Cities", "Waste Management", "Infrastructure",
];

export default function CreateOpportunityModal({ isOpen, onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Mentorship");
  const [description, setDescription] = useState("");
  const [maxTeams, setMaxTeams] = useState(3);
  const [categories, setCategories] = useState(["Environment"]);
  const [newCategory, setNewCategory] = useState("");
  const [resources, setResources] = useState([]);
  const [newResource, setNewResource] = useState("");

  if (!isOpen) return null;

  const toggleCategory = (cat) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCategory = (e) => {
    e.preventDefault();
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
      setNewCategory("");
    }
  };

  const handleAddResource = (e) => {
    e.preventDefault();
    const trimmed = newResource.trim();
    if (trimmed && !resources.includes(trimmed)) {
      setResources((prev) => [...prev, trimmed]);
      setNewResource("");
    }
  };

  const handleRemoveResource = (index) => {
    setResources((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (title.trim().length < 5) return toast.error("Title must be at least 5 characters.");
    if (description.trim().length < 20) return toast.error("Description must be at least 20 characters.");
    if (categories.length === 0) return toast.error("Select at least one target category.");
    if (resources.length === 0) return toast.error("Specify at least one resource offered.");

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        type,
        description: description.trim(),
        targetCategories: categories,
        resourcesOffered: resources,
        maxTeams: parseInt(maxTeams, 10) || 3,
      };

      const res = await partnershipService.createOpportunity(payload);
      toast.success("Partnership opportunity published successfully! 🎉");
      if (onCreated) onCreated(res.data);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create opportunity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl glass p-6 sm:p-8 relative my-8 border-emerald-500/30">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-white/50 hover:text-white transition"
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Post Partnership Opportunity</h2>
            <p className="text-xs text-white/50">Offer mentorship, funding, datasets or internships to student teams</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="label">Opportunity Title *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Smart Agriculture IoT Mentorship & Cloud Credits"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Type & Max Teams */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Opportunity Type *</label>
              <select
                className="input bg-dark-700"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="Mentorship">Mentorship</option>
                <option value="Funding">Funding</option>
                <option value="Dataset">Dataset</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div>
              <label className="label">Max Teams to Accept *</label>
              <input
                type="number"
                min="1"
                max="50"
                className="input"
                value={maxTeams}
                onChange={(e) => setMaxTeams(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Description & Scope *</label>
            <textarea
              rows={3}
              className="input resize-none"
              placeholder="Describe what your organization is providing, what solutions you are looking for, and expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Target Categories */}
          <div>
            <label className="label flex items-center gap-2">
              <Layers size={14} className="text-primary-400" /> Target Challenge Categories *
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DEFAULT_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
                    categories.includes(cat)
                      ? "bg-primary-500 text-white border-primary-400"
                      : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="input text-xs py-2"
                placeholder="Or type custom category..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCustomCategory(e)}
              />
              <button
                type="button"
                onClick={handleAddCustomCategory}
                className="btn-ghost px-3 py-2 text-xs"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          {/* Resources Offered */}
          <div>
            <label className="label flex items-center gap-2">
              <Gift size={14} className="text-emerald-400" /> Resources Offered *
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                className="input text-xs py-2"
                placeholder="e.g. $2,000 Seed Grant, AWS Cloud Credits, 1:1 Bi-weekly Mentorship"
                value={newResource}
                onChange={(e) => setNewResource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddResource(e)}
              />
              <button
                type="button"
                onClick={handleAddResource}
                className="btn-ghost px-4 py-2 text-xs"
              >
                <Plus size={14} /> Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[32px]">
              {resources.map((res, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30"
                >
                  {res}
                  <button
                    type="button"
                    onClick={() => handleRemoveResource(i)}
                    className="hover:text-red-400 transition"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {resources.length === 0 && (
                <span className="text-xs text-white/30 italic">No resources added yet.</span>
              )}
            </div>
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
              className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-500"
            >
              {loading ? "Publishing..." : "Publish Opportunity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

