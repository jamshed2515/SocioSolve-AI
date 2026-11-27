import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Pin,
  Lock,
  Unlock,
  Edit3,
  Trash2,
  CornerDownRight,
  MessageSquare,
  Clock,
  Send,
  Loader2,
  AlertCircle,
  Tag,
  Shield,
  Check,
  Crown,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import teamApi from "../services/teamApi";
import type { DiscussionComment, TeamDiscussion } from "../types";

interface DiscussionThreadViewProps {
  discussionId: string;
  onClose: () => void;
  onDiscussionDeleted: (id: string) => void;
  onDiscussionUpdated: (updated: TeamDiscussion) => void;
  onEditDiscussion: (discussion: TeamDiscussion) => void;
}

export default function DiscussionThreadView({
  discussionId,
  onClose,
  onDiscussionDeleted,
  onDiscussionUpdated,
  onEditDiscussion,
}: DiscussionThreadViewProps) {
  const [discussion, setDiscussion] = useState<TeamDiscussion | null>(null);
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New comment states
  const [newCommentContent, setNewCommentContent] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Reply states
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Edit comment states
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete dialogs
  const [isDeleteDiscConfirmOpen, setIsDeleteDiscConfirmOpen] = useState(false);
  const [isDeletingDisc, setIsDeletingDisc] = useState(false);

  // Pin & Lock toggling states
  const [isTogglingPin, setIsTogglingPin] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [discData, commentsData] = await Promise.all([
        teamApi.getDiscussionDetails(discussionId),
        teamApi.getDiscussionComments(discussionId),
      ]);
      setDiscussion(discData);
      setComments(commentsData.items || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to load discussion thread.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [discussionId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  // Handle Pin / Unpin
  const handleTogglePin = async () => {
    if (!discussion || isTogglingPin) return;
    setIsTogglingPin(true);
    try {
      const updated = await teamApi.togglePinDiscussion(discussion.id);
      setDiscussion(updated);
      onDiscussionUpdated(updated);
      toast.success(updated.is_pinned ? "Discussion pinned to top." : "Discussion unpinned.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update pin state.";
      toast.error(msg);
    } finally {
      setIsTogglingPin(false);
    }
  };

  // Handle Lock / Unlock
  const handleToggleLock = async () => {
    if (!discussion || isTogglingLock) return;
    setIsTogglingLock(true);
    try {
      const updated = await teamApi.toggleLockDiscussion(discussion.id);
      setDiscussion(updated);
      onDiscussionUpdated(updated);
      toast.success(updated.is_locked ? "Discussion locked. Comments disabled." : "Discussion unlocked.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update lock state.";
      toast.error(msg);
    } finally {
      setIsTogglingLock(false);
    }
  };

  // Handle Delete Discussion
  const handleDeleteDiscussion = async () => {
    if (!discussion || isDeletingDisc) return;
    setIsDeletingDisc(true);
    try {
      await teamApi.deleteDiscussion(discussion.id);
      toast.success("Discussion deleted.");
      onDiscussionDeleted(discussion.id);
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete discussion.";
      toast.error(msg);
      setIsDeletingDisc(false);
    }
  };

  // Handle Post New Top-Level Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discussion || !newCommentContent.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    try {
      const posted = await teamApi.addComment(discussion.id, {
        content: newCommentContent.trim(),
      });
      setComments((prev) => [...prev, posted]);
      setNewCommentContent("");
      setDiscussion((prev) => (prev ? { ...prev, comment_count: prev.comment_count + 1 } : null));
      toast.success("Comment posted.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to post comment.";
      toast.error(msg);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Handle Post Reply
  const handlePostReply = async (parentCommentId: string) => {
    if (!discussion || !replyContent.trim() || isSubmittingReply) return;
    setIsSubmittingReply(true);
    try {
      const reply = await teamApi.addComment(discussion.id, {
        content: replyContent.trim(),
        parent_comment_id: parentCommentId,
      });

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentCommentId) {
            return {
              ...c,
              replies_count: c.replies_count + 1,
              replies: [...c.replies, reply],
            };
          }
          return c;
        })
      );

      setReplyingToCommentId(null);
      setReplyContent("");
      setDiscussion((prev) => (prev ? { ...prev, comment_count: prev.comment_count + 1 } : null));
      toast.success("Reply posted.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to post reply.";
      toast.error(msg);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Handle Save Comment Edit
  const handleSaveCommentEdit = async (commentId: string) => {
    if (!editContent.trim() || isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      const updated = await teamApi.updateComment(commentId, { content: editContent.trim() });

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return { ...c, content: updated.content, updated_at: updated.updated_at };
          }
          // Search in replies
          const updatedReplies = c.replies.map((r) =>
            r.id === commentId ? { ...r, content: updated.content, updated_at: updated.updated_at } : r
          );
          return { ...c, replies: updatedReplies };
        })
      );

      setEditingCommentId(null);
      setEditContent("");
      toast.success("Comment updated.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to update comment.";
      toast.error(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async (commentId: string, isReply = false, parentId?: string) => {
    try {
      await teamApi.deleteComment(commentId);
      toast.success("Comment deleted.");

      if (isReply && parentId) {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === parentId) {
              const filtered = c.replies.filter((r) => r.id !== commentId);
              return { ...c, replies: filtered, replies_count: filtered.length };
            }
            return c;
          })
        );
      } else {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }

      setDiscussion((prev) => (prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : null));
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Failed to delete comment.";
      toast.error(msg);
    }
  };

  const getCategoryClass = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case "announcements":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "technical":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      case "ideas":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "resources":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "questions":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      default:
        return "bg-primary-500/20 text-primary-300 border-primary-500/30";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="glass relative w-full max-w-3xl rounded-2xl border border-white/10 bg-dark-900/95 shadow-2xl my-6 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {discussion && (
              <>
                <span className={`badge text-[11px] font-semibold border ${getCategoryClass(discussion.category)} capitalize`}>
                  <Tag size={11} className="mr-1 inline" />
                  {discussion.category}
                </span>

                {discussion.is_pinned && (
                  <span className="badge text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                    <Pin size={11} /> Pinned
                  </span>
                )}

                {discussion.is_locked && (
                  <span className="badge text-[11px] bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-semibold">
                    <Lock size={11} /> Locked
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {discussion && (
              <>
                {discussion.can_pin && (
                  <button
                    type="button"
                    onClick={handleTogglePin}
                    disabled={isTogglingPin}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-amber-300 transition"
                    title={discussion.is_pinned ? "Unpin Discussion" : "Pin Discussion"}
                  >
                    <Pin size={15} className={discussion.is_pinned ? "text-amber-400 fill-amber-400" : ""} />
                  </button>
                )}

                {discussion.can_lock && (
                  <button
                    type="button"
                    onClick={handleToggleLock}
                    disabled={isTogglingLock}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-rose-300 transition"
                    title={discussion.is_locked ? "Unlock Discussion" : "Lock Discussion"}
                  >
                    {discussion.is_locked ? <Unlock size={15} className="text-emerald-400" /> : <Lock size={15} />}
                  </button>
                )}

                {discussion.can_edit && (
                  <button
                    type="button"
                    onClick={() => onEditDiscussion(discussion)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-primary-300 transition"
                    title="Edit Discussion"
                  >
                    <Edit3 size={15} />
                  </button>
                )}

                {discussion.can_delete && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteDiscConfirmOpen(true)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 transition"
                    title="Delete Discussion"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-white/40 hover:text-white p-1 rounded-lg transition-colors ml-2"
              aria-label="Close thread"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 size={32} className="animate-spin mx-auto text-primary-400" />
              <p className="text-xs text-white/50">Loading discussion thread...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {discussion && (
            <>
              {/* Discussion Header & Content */}
              <div className="space-y-4">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                  {discussion.title}
                </h1>

                {/* Author Info & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-white/50 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {discussion.author_name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <span className="text-white font-semibold flex items-center gap-1.5">
                        {discussion.author_name}
                        {discussion.author_role === "Team Leader" && (
                          <Crown size={12} className="text-amber-400 inline" />
                        )}
                        <span className="badge text-[9px] px-1.5 py-0.2 bg-white/5 text-white/60">
                          {discussion.author_role}
                        </span>
                      </span>
                      <span className="text-[11px] text-white/40">{discussion.author_email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(discussion.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1 text-primary-300">
                      <MessageSquare size={12} /> {discussion.comment_count} comments
                    </span>
                  </div>
                </div>

                {/* Main Body */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
                  {discussion.content}
                </div>
              </div>

              {/* ── COMMENTS SECTION ───────────────────────────────────── */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageSquare size={16} className="text-primary-400" />
                  Discussion Thread ({comments.length})
                </h3>

                {/* Locked Banner */}
                {discussion.is_locked ? (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                    <Lock size={15} className="shrink-0 text-rose-400" />
                    <span>
                      <strong>Discussion Locked:</strong> The team leader has concluded this thread. No new comments or replies can be posted.
                    </span>
                  </div>
                ) : (
                  /* Comment Form */
                  <form onSubmit={handlePostComment} className="space-y-2">
                    <textarea
                      rows={3}
                      value={newCommentContent}
                      onChange={(e) => setNewCommentContent(e.target.value)}
                      placeholder="Share your perspective or ask a follow-up question..."
                      className="input text-xs w-full resize-none leading-relaxed"
                      maxLength={5000}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-white/40">
                        {newCommentContent.length}/5,000
                      </span>
                      <button
                        type="submit"
                        disabled={isSubmittingComment || !newCommentContent.trim()}
                        className="btn btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                      >
                        {isSubmittingComment ? (
                          <>
                            <Loader2 size={13} className="animate-spin" /> Posting...
                          </>
                        ) : (
                          <>
                            <Send size={13} /> Post Comment
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* Comments List */}
                {comments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-xl">
                    No comments yet. Be the first to start the dialogue!
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3"
                      >
                        {/* Comment Header */}
                        <div className="flex items-start justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-400 flex items-center justify-center font-bold text-[11px] text-white shrink-0">
                              {comment.author_name?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <span className="text-white font-semibold text-xs flex items-center gap-1">
                                {comment.author_name}
                                <span className="badge text-[9px] px-1 py-0.2 bg-white/5 text-white/60">
                                  {comment.author_role}
                                </span>
                              </span>
                              <span className="text-[10px] text-white/40">
                                {new Date(comment.created_at).toLocaleTimeString(undefined, {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                &bull;{" "}
                                {new Date(comment.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Comment Actions */}
                          <div className="flex items-center gap-1 text-[11px]">
                            {!discussion.is_locked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingToCommentId(
                                    replyingToCommentId === comment.id ? null : comment.id
                                  );
                                  setReplyContent("");
                                }}
                                className="px-2 py-0.5 rounded hover:bg-white/5 text-primary-300 font-medium transition"
                              >
                                Reply
                              </button>
                            )}

                            {comment.can_edit && !discussion.is_locked && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCommentId(comment.id);
                                  setEditContent(comment.content);
                                }}
                                className="px-2 py-0.5 rounded hover:bg-white/5 text-white/50 hover:text-white transition"
                              >
                                Edit
                              </button>
                            )}

                            {comment.can_delete && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteComment(comment.id)}
                                className="px-2 py-0.5 rounded hover:bg-red-500/10 text-red-400 transition"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Comment Content or Edit Form */}
                        {editingCommentId === comment.id ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              rows={2}
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="input text-xs w-full resize-none"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingCommentId(null)}
                                className="btn btn-secondary text-xs px-2.5 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSavingEdit || !editContent.trim()}
                                onClick={() => void handleSaveCommentEdit(comment.id)}
                                className="btn btn-primary text-xs px-3 py-1 flex items-center gap-1"
                              >
                                {isSavingEdit ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}{" "}
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap pl-9">
                            {comment.content}
                          </p>
                        )}

                        {/* Inline Reply Form */}
                        {replyingToCommentId === comment.id && !discussion.is_locked && (
                          <div className="ml-9 p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 animate-fade-in">
                            <div className="flex items-center gap-1 text-[11px] text-primary-300 font-medium">
                              <CornerDownRight size={12} /> Replying to {comment.author_name}
                            </div>
                            <textarea
                              rows={2}
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Write your reply..."
                              className="input text-xs w-full resize-none"
                              autoFocus
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReplyingToCommentId(null)}
                                className="btn btn-secondary text-xs px-2.5 py-1"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isSubmittingReply || !replyContent.trim()}
                                onClick={() => void handlePostReply(comment.id)}
                                className="btn btn-primary text-xs px-3 py-1 flex items-center gap-1"
                              >
                                {isSubmittingReply ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Send size={12} />
                                )}{" "}
                                Reply
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Nested Replies (1 Level Depth) */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="ml-6 sm:ml-9 space-y-2.5 pt-2 border-l-2 border-white/10 pl-3">
                            {comment.replies.map((reply) => (
                              <div
                                key={reply.id}
                                className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-400 to-primary-500 flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                                      {reply.author_name?.[0]?.toUpperCase() || "U"}
                                    </div>
                                    <div>
                                      <span className="text-white font-medium text-xs flex items-center gap-1">
                                        {reply.author_name}
                                        <span className="badge text-[8px] px-1 py-0.1 bg-white/5 text-white/50">
                                          {reply.author_role}
                                        </span>
                                      </span>
                                      <span className="text-[10px] text-white/40">
                                        {new Date(reply.created_at).toLocaleTimeString(undefined, {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 text-[11px]">
                                    {reply.can_edit && !discussion.is_locked && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentId(reply.id);
                                          setEditContent(reply.content);
                                        }}
                                        className="px-1.5 py-0.5 rounded text-white/50 hover:text-white transition"
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {reply.can_delete && (
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteComment(reply.id, true, comment.id)}
                                        className="px-1.5 py-0.5 rounded text-red-400 transition"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {editingCommentId === reply.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      rows={2}
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      className="input text-xs w-full resize-none"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingCommentId(null)}
                                        className="btn btn-secondary text-xs px-2.5 py-0.5"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isSavingEdit || !editContent.trim()}
                                        onClick={() => void handleSaveCommentEdit(reply.id)}
                                        className="btn btn-primary text-xs px-3 py-0.5 flex items-center gap-1"
                                      >
                                        {isSavingEdit ? (
                                          <Loader2 size={11} className="animate-spin" />
                                        ) : (
                                          <Check size={11} />
                                        )}{" "}
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap pl-8">
                                    {reply.content}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {isDeleteDiscConfirmOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          >
            <div className="glass max-w-sm w-full p-6 bg-dark-800/95 border-red-500/30 rounded-2xl space-y-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle size={20} />
              </div>
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-white">Delete Discussion?</h4>
                <p className="text-xs text-white/60">
                  This will permanently delete this discussion and all {comments.length} comments.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isDeletingDisc}
                  onClick={() => setIsDeleteDiscConfirmOpen(false)}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeletingDisc}
                  onClick={handleDeleteDiscussion}
                  className="btn bg-red-600 hover:bg-red-700 text-white text-xs px-4 py-1.5 flex items-center gap-1.5"
                >
                  {isDeletingDisc ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
