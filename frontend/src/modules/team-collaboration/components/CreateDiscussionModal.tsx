import React, { useState, useEffect } from "react";
import {
  X,
  MessageSquarePlus,
  Loader2,
  AlertCircle,
  Tag,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { DiscussionCategory, TeamDiscussion } from "../types";

const CATEGORIES: DiscussionCategory[] = [
  "General",
  "Ideas",
  "Technical",
  "Resources",
  "Announcements",
  "Questions",
];

interface CreateDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  onSuccess: (newDiscussion?: TeamDiscussion) => void;
  initialDiscussion?: TeamDiscussion | null; // For editing
}

export default function CreateDiscussionModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  onSuccess,
  initialDiscussion,
}: CreateDiscussionModalProps) {
  const isEditing = Boolean(initialDiscussion);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<DiscussionCategory>("General");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialDiscussion) {
        setTitle(initialDiscussion.title);
        setContent(initialDiscussion.content);
        setCategory((initialDiscussion.category as DiscussionCategory) || "General");
      } else {
        setTitle("");
        setContent("");
        setCategory("General");
      }
      setErrorMsg(null);
    }
  }, [isOpen, initialDiscussion]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    if (cleanTitle.length < 2) {
      setErrorMsg("Title must be at least 2 characters.");
      return;
    }
    if (cleanContent.length < 5) {
      setErrorMsg("Content must be at least 5 characters.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (isEditing && initialDiscussion) {
        const updated = await teamApi.updateDiscussion(initialDiscussion.id, {
          title: cleanTitle,
          content: cleanContent,
          category,
        });
        toast.success("Discussion updated successfully!");
        onSuccess(updated);
      } else {
        const created = await teamApi.createDiscussion(teamId, {
          title: cleanTitle,
          content: cleanContent,
          category,
        });
        toast.success("Discussion published!");
        onSuccess(created);
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || `Failed to ${isEditing ? "update" : "create"} discussion.`;
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="glass relative w-full max-w-lg rounded-2xl border border-white/10 bg-dark-900/95 p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/15 text-primary-400 flex items-center justify-center border border-primary-500/20">
              <MessageSquarePlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? "Edit Discussion" : "Start New Discussion"}
              </h2>
              <p className="text-xs text-white/50">
                Team: <span className="text-white font-medium">{teamName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/40 hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/25 text-rose-300 text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Discussion Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
              <span>Discussion Title *</span>
              <span className="text-[11px] text-white/40">{title.length}/200</span>
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Approach for low-cost water telemetry in Bokaro"
              className="input text-xs w-full"
              autoFocus
            />
          </div>

          {/* Category Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
              <Tag size={13} className="text-primary-400" /> Category *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DiscussionCategory)}
              className="input text-xs w-full bg-dark-900 border-white/15"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-dark-900 text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Discussion Content */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
              <span>Discussion Details *</span>
              <span className="text-[11px] text-white/40">{content.length}/10,000</span>
            </label>
            <textarea
              required
              rows={5}
              maxLength={10000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the context, technical challenges, or specific questions you'd like your squad to weigh in on..."
              className="input text-xs w-full resize-none leading-relaxed"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || title.trim().length < 2 || content.trim().length < 5}
              className="btn btn-primary text-xs px-5 py-2 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Send size={14} /> {isEditing ? "Save Changes" : "Publish Discussion"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
