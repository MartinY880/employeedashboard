// ProConnect — MyShare Post Card
// Single post in the myshare social feed

"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MentionInput, type MentionInputHandle } from "@/components/shared/MentionInput";
import { MentionChip } from "@/components/shared/ProfileDialog";
import {
  Heart,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ThumbsUp,
  Send,
  Reply,
  X,
  Loader2,
  MoreHorizontal,
  Maximize2,
} from "lucide-react";
import { useSounds } from "@/components/shared/SoundProvider";
import type { MySharePost, MyShareComment, MyShareMedia } from "@/types";

/* ─── Helpers ──────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPhotoUrl(authorEmail: string | undefined, authorName: string): string {
  if (authorEmail) {
    return `/api/directory/photo?email=${encodeURIComponent(authorEmail)}&name=${encodeURIComponent(authorName)}&size=120x120`;
  }
  return `/api/directory/photo?name=${encodeURIComponent(authorName)}&size=120x120`;
}

const MENTION_RENDER_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

function renderMentionContent(content: string) {
  const parts: (string | ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_RENDER_REGEX.source, "g");
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <MentionChip
        key={key++}
        userId={match[2]}
        displayName={match[1]}
      />,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

/* ─── Media Lightbox (fullscreen overlay) ──────────────── */

function MediaLightbox({
  media,
  startIndex,
  onClose,
  post,
  onLike,
  fetchComments,
  addComment,
  toggleCommentLike,
  deleteComment,
}: {
  media: MyShareMedia[];
  startIndex: number;
  onClose: () => void;
  post: MySharePost;
  onLike: () => void;
  fetchComments: (postId: string) => Promise<MyShareComment[]>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<MyShareComment>;
  toggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState(startIndex);
  const [comments, setComments] = useState<MyShareComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<MentionInputHandle>(null);
  const { playClick, playSuccess } = useSounds();
  const touchStartX = useRef(0);

  const goTo = useCallback(
    (idx: number) => setCurrent(Math.max(0, Math.min(idx, media.length - 1))),
    [media.length],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goTo(current - 1);
      if (e.key === "ArrowRight") goTo(current + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [current, goTo, onClose]);

  // Fetch comments
  useEffect(() => {
    fetchComments(post.id)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [post.id, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const comment = await addComment(post.id, newComment.trim(), replyTo?.id);
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), comment] } : c,
          ),
        );
      } else {
        setComments((prev) => [...prev, comment]);
      }
      setNewComment("");
      setReplyTo(null);
      playSuccess();
    } catch { /* silent */ } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(post.id, commentId);
      const wasTopLevel = comments.some((c) => c.id === commentId);
      if (wasTopLevel) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } else {
        setComments((prev) =>
          prev.map((c) => ({ ...c, replies: (c.replies || []).filter((r) => r.id !== commentId) })),
        );
      }
    } catch { /* silent */ }
  };

  const handleLikeComment = async (commentId: string) => {
    playClick();
    const updateLike = (list: MyShareComment[]): MyShareComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const liked = !c.userLiked;
          return { ...c, userLiked: liked, likes: c.likes + (liked ? 1 : -1) };
        }
        return { ...c, replies: updateLike(c.replies || []) };
      });
    setComments(updateLike);
    try {
      await toggleCommentLike(post.id, commentId);
    } catch {
      setComments(updateLike);
    }
  };

  const item = media[current];
  const isVideo = item.mimeType?.startsWith("video/");
  const authorPhoto = getPhotoUrl(post.authorEmail, post.authorName);
  const [mobileComments, setMobileComments] = useState(false);
  const totalCommentCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ── Mobile Layout ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="md:hidden flex flex-col w-full h-full"
      >
        {/* Full image area — clicking the black background closes */}
        <div
          className="flex-1 flex items-center justify-center bg-black relative"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const diff = touchStartX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) goTo(diff > 0 ? current + 1 : current - 1);
          }}
        >
          {isVideo ? (
            <video src={item.fileUrl} controls autoPlay playsInline className="max-w-full max-h-full object-contain" />
          ) : (
            <motion.img
              key={item.id}
              src={item.fileUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}

          {/* Prev/Next */}
          {current > 0 && (
            <button onClick={() => goTo(current - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {current < media.length - 1 && (
            <button onClick={() => goTo(current + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Dots */}
          {media.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {media.map((m, i) => (
                <button key={m.id} onClick={() => goTo(i)} className={`rounded-full transition-all ${i === current ? "w-2.5 h-2.5 bg-white" : "w-2 h-2 bg-white/40"}`} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar: like + comments button */}
        <div className="shrink-0 bg-black/80 backdrop-blur-sm px-4 py-3 flex items-center gap-4 border-t border-white/10">
          <button onClick={onLike} className="flex items-center gap-1.5">
            <Heart className={`w-6 h-6 ${post.userLiked ? "fill-rose-500 text-rose-500" : "text-white"}`} />
            {post.likeCount > 0 && (
              <span className={`text-[13px] font-semibold tabular-nums ${post.userLiked ? "text-rose-500" : "text-white/70"}`}>
                {post.likeCount}
              </span>
            )}
          </button>
          <button onClick={() => setMobileComments(true)} className="flex items-center gap-1.5">
            <MessageCircle className="w-6 h-6 text-white" />
            {totalCommentCount > 0 && (
              <span className="text-[13px] font-semibold text-white/70 tabular-nums">{totalCommentCount}</span>
            )}
          </button>
          <span className="ml-auto text-[11px] text-white/50">{post.authorName} · {getRelativeTime(post.createdAt)}</span>
        </div>

        {/* Mobile comments bottom sheet (75% screen) */}
        <AnimatePresence>
          {mobileComments && (
            <motion.div
              key="mobile-comments-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col justify-end"
            >
              <div className="absolute inset-0 bg-black/40" onClick={() => { setMobileComments(false); onClose(); }} />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative h-[75%] bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-center px-5 py-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
                  <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
                    Comments{totalCommentCount > 0 && <span className="ml-1.5 text-gray-400 font-normal text-[13px]">({totalCommentCount})</span>}
                  </h3>
                </div>
                {/* Caption */}
                {post.caption && (
                  <div className="px-5 py-2.5 border-b border-gray-50 dark:border-gray-800/50 shrink-0">
                    <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                      <span className="font-bold text-gray-900 dark:text-gray-100 mr-1.5">{post.authorName}</span>
                      {renderMentionContent(post.caption)}
                    </p>
                  </div>
                )}
                {/* Comments list */}
                <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                    </div>
                  ) : comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <MessageCircle className="w-8 h-8 text-gray-200 dark:text-gray-700 mb-2" />
                      <p className="text-[12px] text-gray-400">No comments yet</p>
                    </div>
                  ) : (
                    comments.map((c) => (
                      <CommentWithReplies
                        key={c.id}
                        comment={c}
                        onDelete={handleDeleteComment}
                        onLike={handleLikeComment}
                        onReplyClick={(id, name) => {
                          setReplyTo({ id, name });
                          inputRef.current?.focus();
                        }}
                      />
                    ))
                  )}
                </div>
                {/* Comment input */}
                <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
                  {replyTo && (
                    <div className="flex items-center gap-1.5 text-[10px] text-brand-blue mb-2">
                      <Reply className="w-3 h-3" />
                      <span>Replying to <strong>{replyTo.name}</strong></span>
                      <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  )}
                  <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                    <MentionInput
                      ref={inputRef}
                      placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Add a comment…"}
                      value={newComment}
                      onChange={setNewComment}
                      className="h-9 text-[13px] bg-gray-50 dark:bg-gray-800 dark:border-gray-700 border-gray-200 rounded-full flex-1 px-4"
                      maxLength={1000}
                    />
                    <Button type="submit" size="sm" disabled={!newComment.trim() || sending} className="h-9 w-9 p-0 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white shrink-0">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Desktop Layout ── */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="hidden md:flex bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl max-w-5xl w-full max-h-[90vh]"
      >
        {/* Left: Media */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[400px] max-h-[90vh]">
          {isVideo ? (
            <video src={item.fileUrl} controls autoPlay playsInline className="max-w-full max-h-[90vh] object-contain" />
          ) : (
            <motion.img
              key={item.id}
              src={item.fileUrl}
              alt=""
              className="max-w-full max-h-[90vh] object-contain"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}

          {current > 0 && (
            <button onClick={() => goTo(current - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          {current < media.length - 1 && (
            <button onClick={() => goTo(current + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {media.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {media.map((m, i) => (
                <button key={m.id} onClick={() => goTo(i)} className={`rounded-full transition-all ${i === current ? "w-2.5 h-2.5 bg-white" : "w-2 h-2 bg-white/40 hover:bg-white/70"}`} />
              ))}
            </div>
          )}
        </div>

        {/* Right: Author + Caption + Comments */}
        <div className="w-[340px] shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 max-h-[90vh]">
          {/* Author header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <Avatar className="h-8 w-8 ring-2 ring-gray-100 dark:ring-gray-700">
              <AvatarImage src={authorPhoto} alt={post.authorName} />
              <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[10px] font-bold">
                {getInitials(post.authorName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 leading-tight truncate">
                {post.authorName}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {getRelativeTime(post.createdAt)}
              </p>
            </div>
          </div>

          {/* Scrollable: caption + comments */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {post.caption && (
              <div className="px-4 py-3 border-b border-gray-50 dark:border-gray-800/50">
                <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                  <span className="font-bold text-gray-900 dark:text-gray-100 mr-1.5">{post.authorName}</span>
                  {renderMentionContent(post.caption)}
                </p>
              </div>
            )}

            <div className="px-4 py-3 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageCircle className="w-8 h-8 text-gray-200 dark:text-gray-700 mb-2" />
                  <p className="text-[12px] text-gray-400">No comments yet</p>
                </div>
              ) : (
                comments.map((c) => (
                  <CommentWithReplies
                    key={c.id}
                    comment={c}
                    onDelete={handleDeleteComment}
                    onLike={handleLikeComment}
                    onReplyClick={(id, name) => {
                      setReplyTo({ id, name });
                      inputRef.current?.focus();
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Like bar */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button onClick={onLike} className="flex items-center gap-1.5 group/like transition-colors">
              <Heart className={`w-5 h-5 transition-all ${
                post.userLiked
                  ? "fill-rose-500 text-rose-500 scale-110"
                  : "text-gray-600 dark:text-gray-400 group-hover/like:text-rose-500"
              }`} />
              {post.likeCount > 0 && (
                <span className={`text-[13px] font-semibold tabular-nums ${
                  post.userLiked ? "text-rose-500" : "text-gray-600 dark:text-gray-400"
                }`}>
                  {post.likeCount} {post.likeCount === 1 ? "like" : "likes"}
                </span>
              )}
            </button>
          </div>

          {/* Comment input */}
          <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-3">
            {replyTo && (
              <div className="flex items-center gap-1.5 text-[10px] text-brand-blue mb-2">
                <Reply className="w-3 h-3" />
                <span>Replying to <strong>{replyTo.name}</strong></span>
                <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2 items-center">
              <MentionInput
                ref={inputRef}
                placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Add a comment…"}
                value={newComment}
                onChange={setNewComment}
                className="h-8 text-[12px] bg-gray-50 dark:bg-gray-800 dark:border-gray-700 border-gray-200 rounded-full flex-1 px-3"
                maxLength={1000}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newComment.trim() || sending}
                className="h-8 w-8 p-0 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white shrink-0"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}

/* ─── Image Carousel (compact feed view) ───────────────── */

function ImageCarousel({ media, onOpenLightbox }: { media: MyShareMedia[]; onOpenLightbox: (idx: number) => void }) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);

  const goTo = useCallback((idx: number) => {
    setCurrent(Math.max(0, Math.min(idx, media.length - 1)));
  }, [media.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      goTo(diff > 0 ? current + 1 : current - 1);
    }
  };

  if (media.length === 0) return null;

  // Single item — no carousel controls
  if (media.length === 1) {
    const isVideo = media[0].mimeType?.startsWith("video/");
    return (
      <div
        className="relative w-full flex items-center justify-center cursor-pointer group/media"
        onClick={() => onOpenLightbox(0)}
      >
        {isVideo ? (
          <video
            src={media[0].fileUrl}
            playsInline
            muted
            className="max-w-full max-h-[220px] object-contain"
            onClick={(e) => { e.stopPropagation(); onOpenLightbox(0); }}
          />
        ) : (
          <img
            src={media[0].fileUrl}
            alt=""
            className="max-w-full max-h-[220px] object-contain"
          />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/10 transition-colors flex items-center justify-center">
          <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover/media:opacity-80 transition-opacity drop-shadow-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full group/carousel select-none cursor-pointer"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => onOpenLightbox(current)}
    >
      {/* Image / Video */}
      <div className="relative overflow-hidden flex items-center justify-center min-h-[140px]">
        {media[current].mimeType?.startsWith("video/") ? (
          <motion.div
            key={media[current].id}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <video
              src={media[current].fileUrl}
              playsInline
              muted
              className="max-w-full max-h-[220px]"
            />
          </motion.div>
        ) : (
          <motion.img
            key={media[current].id}
            src={media[current].fileUrl}
            alt=""
            className="max-w-full max-h-[220px] object-contain"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
        <div className="absolute inset-0 bg-black/0 group-hover/carousel:bg-black/10 transition-colors flex items-center justify-center">
          <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover/carousel:opacity-80 transition-opacity drop-shadow-lg" />
        </div>
        {/* Preload adjacent images */}
        {media.map((m, i) =>
          i !== current && !m.mimeType?.startsWith("video/") ? (
            <link key={m.id} rel="preload" as="image" href={m.fileUrl} />
          ) : null,
        )}
      </div>

      {/* Prev/Next Arrows */}
      {current > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(current - 1); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/60"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      {current < media.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goTo(current + 1); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-black/60"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Dots */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {media.map((m, i) => (
          <button
            key={m.id}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all ${
              i === current
                ? "w-2 h-2 bg-white shadow-sm"
                : "w-1.5 h-1.5 bg-white/50 hover:bg-white/70"
            }`}
          />
        ))}
      </div>

      {/* Counter */}
      <div className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-white font-medium">
        {current + 1}/{media.length}
      </div>
    </div>
  );
}

/* ─── Comment Row (Pixelfed media-style) ───────────────── */

function CommentRow({
  comment,
  onDelete,
  onLike,
  onReplyClick,
  isReply = false,
}: {
  comment: MyShareComment;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReplyClick?: (id: string, authorName: string) => void;
  isReply?: boolean;
}) {
  const photoUrl = getPhotoUrl(comment.authorEmail, comment.authorName);

  return (
    <div className={`flex gap-2.5 ${isReply ? "ml-10 mt-2" : ""}`}>
      <Avatar className={`shrink-0 ${isReply ? "h-6 w-6" : "h-8 w-8"}`}>
        <AvatarImage src={photoUrl} alt={comment.authorName} />
        <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[9px] font-bold">
          {getInitials(comment.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className={`text-gray-700 dark:text-gray-300 leading-relaxed ${isReply ? "text-[11px]" : "text-[12px]"}`}>
          <span className="font-bold text-gray-900 dark:text-gray-100 mr-1">
            {comment.authorName}
          </span>
          {renderMentionContent(comment.content)}
        </p>
        {comment.likes > 0 && (
          <button
            onClick={() => onLike(comment.id)}
            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm text-[10px] text-gray-500 dark:text-gray-400 hover:text-brand-blue transition-colors"
          >
            <ThumbsUp className={`w-2.5 h-2.5 ${comment.userLiked ? "fill-brand-blue text-brand-blue" : ""}`} />
            <span className="font-semibold tabular-nums">{comment.likes}</span>
          </button>
        )}
        <div className="flex items-center gap-0 mt-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => onLike(comment.id)}
            className={`transition-colors ${
              comment.userLiked
                ? "text-red-500"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {comment.userLiked ? "Liked" : "Like"}
          </button>
          {!isReply && onReplyClick && (
            <>
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              <button
                type="button"
                onClick={() => onReplyClick(comment.id, comment.authorName)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Reply
              </button>
            </>
          )}
          <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-400 dark:text-gray-500 font-normal">
            {getRelativeTime(comment.createdAt)}
          </span>
          {comment.canDelete && (
            <>
              <span className="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Comment With Collapsible Replies ─────────────────── */

function CommentWithReplies({
  comment,
  onDelete,
  onLike,
  onReplyClick,
}: {
  comment: MyShareComment;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReplyClick: (id: string, authorName: string) => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const replies = comment.replies || [];

  return (
    <div>
      <CommentRow
        comment={comment}
        onDelete={onDelete}
        onLike={onLike}
        onReplyClick={onReplyClick}
      />
      {replies.length > 0 && (
        <div className="ml-10 mt-1">
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 hover:text-brand-blue transition-colors flex items-center gap-1"
          >
            <span className="w-6 h-px bg-gray-300 dark:bg-gray-600 inline-block" />
            {showReplies ? `Hide ${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : `Show ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
          </button>
          <AnimatePresence>
            {showReplies && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-1.5">
                  {replies.map((r) => (
                    <CommentRow
                      key={r.id}
                      comment={r}
                      onDelete={onDelete}
                      onLike={onLike}
                      isReply
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ─── Comments Sheet (Instagram bottom-sheet, scoped to widget) ── */

function CommentsSheet({
  postId,
  postAuthorName,
  postCaption,
  commentCount,
  fetchComments,
  addComment,
  toggleCommentLike,
  deleteComment,
  open,
  onOpenChange,
}: {
  postId: string;
  postAuthorName: string;
  postCaption: string | null;
  commentCount: number;
  fetchComments: (postId: string) => Promise<MyShareComment[]>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<MyShareComment>;
  toggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [comments, setComments] = useState<MyShareComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const { playClick, playSuccess } = useSounds();
  const inputRef = useRef<MentionInputHandle>(null);

  // Find the Highlights widget container to portal into
  useEffect(() => {
    setContainer(document.querySelector("[data-myshare-container]"));
  }, []);

  // Fetch comments when sheet opens
  useEffect(() => {
    if (open && !loaded) {
      setLoading(true);
      fetchComments(postId)
        .then((data) => setComments(data))
        .catch(() => {})
        .finally(() => { setLoading(false); setLoaded(true); });
    }
  }, [open, loaded, postId, fetchComments]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      setReplyTo(null);
      setNewComment("");
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onOpenChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const comment = await addComment(postId, newComment.trim(), replyTo?.id);
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id
              ? { ...c, replies: [...(c.replies || []), comment] }
              : c,
          ),
        );
      } else {
        setComments((prev) => [...prev, comment]);
      }
      setNewComment("");
      setReplyTo(null);
      playSuccess();
    } catch { /* silent */ } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(postId, commentId);
      const wasTopLevel = comments.some((c) => c.id === commentId);
      if (wasTopLevel) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      } else {
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
          })),
        );
      }
    } catch { /* silent */ }
  };

  const handleLike = async (commentId: string) => {
    playClick();
    const updateLike = (list: MyShareComment[]): MyShareComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const liked = !c.userLiked;
          return { ...c, userLiked: liked, likes: c.likes + (liked ? 1 : -1) };
        }
        return { ...c, replies: updateLike(c.replies || []) };
      });
    setComments(updateLike);

    try {
      await toggleCommentLike(postId, commentId);
    } catch {
      setComments(updateLike); // revert
    }
  };

  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0) || commentCount;

  if (!container) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="comments-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-40 flex flex-col justify-end"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />

          {/* Bottom sheet — 75% of widget height */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative h-[75%] bg-white dark:bg-gray-900 rounded-t-2xl border-t border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-center px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <h3 className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
                Comments{totalComments > 0 && <span className="ml-1.5 text-gray-400 font-normal text-[13px]">({totalComments})</span>}
              </h3>
            </div>

            {/* Caption as first "comment" */}
            {postCaption && (
              <div className="px-5 py-3 border-b border-gray-50 dark:border-gray-800/50 shrink-0">
                <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                  <span className="font-bold text-gray-900 dark:text-gray-100 mr-1.5">{postAuthorName}</span>
                  {renderMentionContent(postCaption)}
                </p>
              </div>
            )}

            {/* Scrollable comments list */}
            <div className="min-h-0 overflow-y-auto px-5 py-4 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading comments…
                </div>
              ) : comments.length === 0 && loaded ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <MessageCircle className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-2" />
                  <p className="text-[13px] text-gray-400 dark:text-gray-500 font-semibold">No comments yet</p>
                  <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Start the conversation</p>
                </div>
              ) : (
                comments.map((c) => (
                  <CommentWithReplies
                    key={c.id}
                    comment={c}
                    onDelete={handleDelete}
                    onLike={handleLike}
                    onReplyClick={(id, name) => {
                      setReplyTo({ id, name });
                      inputRef.current?.focus();
                    }}
                  />
                ))
              )}
            </div>

            {/* Input footer — pinned at bottom */}
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-white dark:bg-gray-900">
              {replyTo && (
                <div className="flex items-center gap-1.5 text-[10px] text-brand-blue mb-2">
                  <Reply className="w-3 h-3" />
                  <span>Replying to <strong>{replyTo.name}</strong></span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                <MentionInput
                  ref={inputRef}
                  placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Add a comment…"}
                  value={newComment}
                  onChange={setNewComment}
                  className="h-9 text-[13px] bg-gray-50 dark:bg-gray-800 dark:border-gray-700 border-gray-200 rounded-full flex-1 px-4"
                  maxLength={1000}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newComment.trim() || sending}
                  className="h-9 w-9 p-0 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    container,
  );
}

/* ─── Comment Bubble (matches Ideas/Props pattern) ─────── */

function MyShareCommentBubble({
  comment,
  onDelete,
  onLike,
  onReplyClick,
  isReply = false,
}: {
  comment: MyShareComment;
  onDelete: (id: string) => void;
  onLike: (id: string) => void;
  onReplyClick?: (id: string, authorName: string) => void;
  isReply?: boolean;
}) {
  return (
    <div className={isReply ? "ml-8" : ""}>
      <div className="group/comment flex gap-2 items-start">
        <div className={`shrink-0 rounded-full bg-gradient-to-br from-brand-blue/70 to-brand-blue flex items-center justify-center text-white font-bold ${isReply ? "w-6 h-6 text-[9px]" : "w-7 h-7 text-[10px]"}`}>
          {comment.authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="inline-block bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 py-1.5 max-w-[90%]">
            <span className="font-semibold text-[12px] text-gray-800 dark:text-gray-200 block leading-tight">{comment.authorName}</span>
            <p className="text-[12px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed mt-0.5">{renderMentionContent(comment.content)}</p>
          </div>
          <div className="flex items-center gap-2.5 mt-0.5 ml-2 text-[11px]">
            <button
              type="button"
              onClick={() => onLike(comment.id)}
              className={`font-semibold transition-colors ${comment.userLiked ? "text-brand-blue" : "text-gray-400 dark:text-gray-500 hover:text-brand-blue"}`}
            >
              {comment.likes > 0 ? (
                <span className="flex items-center gap-0.5">
                  <ThumbsUp className={`w-3 h-3 ${comment.userLiked ? "fill-brand-blue" : ""}`} />
                  {comment.likes}
                </span>
              ) : "Like"}
            </button>
            {!isReply && onReplyClick && (
              <button
                type="button"
                onClick={() => onReplyClick(comment.id, comment.authorName)}
                className="font-semibold text-gray-400 dark:text-gray-500 hover:text-brand-blue transition-colors"
              >
                Reply
              </button>
            )}
            <span className="text-gray-400 dark:text-gray-500">{getRelativeTime(comment.createdAt)}</span>
            {comment.canDelete && (
              <button
                type="button"
                onClick={() => onDelete(comment.id)}
                className="opacity-0 group-hover/comment:opacity-100 text-gray-300 hover:text-red-500 transition-all"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Comment Thread (matches Ideas pattern) ────── */

function InlineCommentThread({
  postId,
  commentCount,
  fetchComments,
  addComment,
  toggleCommentLike,
  deleteComment,
}: {
  postId: string;
  commentCount: number;
  fetchComments: (postId: string) => Promise<MyShareComment[]>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<MyShareComment>;
  toggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
}) {
  const [comments, setComments] = useState<MyShareComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const { playClick, playSuccess } = useSounds();
  const inputRef = useRef<MentionInputHandle>(null);

  useEffect(() => { setLocalCount(commentCount); }, [commentCount]);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchComments(postId);
      setComments(data);
      const total = data.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0);
      setLocalCount(total || commentCount);
    } catch { /* silent */ } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [postId, commentCount, fetchComments]);

  // Auto-load comments when thread is mounted
  useEffect(() => {
    if (!loaded) loadComments();
  }, [loaded, loadComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const comment = await addComment(postId, newComment.trim(), replyTo?.id);
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo.id ? { ...c, replies: [...(c.replies || []), comment] } : c,
          ),
        );
      } else {
        setComments((prev) => [...prev, comment]);
      }
      setLocalCount((c) => c + 1);
      setNewComment("");
      setReplyTo(null);
      playSuccess();
    } catch { /* silent */ } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(postId, commentId);
      const wasTopLevel = comments.some((c) => c.id === commentId);
      if (wasTopLevel) {
        const removed = comments.find((c) => c.id === commentId);
        const removedCount = 1 + (removed?.replies?.length ?? 0);
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setLocalCount((c) => Math.max(0, c - removedCount));
      } else {
        setComments((prev) =>
          prev.map((c) => ({
            ...c,
            replies: (c.replies || []).filter((r) => r.id !== commentId),
          })),
        );
        setLocalCount((c) => Math.max(0, c - 1));
      }
    } catch { /* silent */ }
  };

  const handleLike = async (commentId: string) => {
    playClick();
    const updateLike = (list: MyShareComment[]): MyShareComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const liked = !c.userLiked;
          return { ...c, userLiked: liked, likes: c.likes + (liked ? 1 : -1) };
        }
        return { ...c, replies: updateLike(c.replies || []) };
      });
    setComments(updateLike);
    try {
      await toggleCommentLike(postId, commentId);
    } catch {
      setComments(updateLike);
    }
  };

  return (
    <div>
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
          </div>
        ) : comments.length === 0 && loaded ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No comments yet — be the first!</p>
        ) : (
          comments.map((c) => (
            <div key={c.id}>
              <MyShareCommentBubble
                comment={c}
                onDelete={handleDelete}
                onLike={handleLike}
                onReplyClick={(id, name) => {
                  setReplyTo({ id, name });
                  inputRef.current?.focus();
                }}
              />
              {(c.replies || []).map((r) => (
                <div key={r.id} className="mt-1.5">
                  <MyShareCommentBubble
                    comment={r}
                    onDelete={handleDelete}
                    onLike={handleLike}
                    isReply
                  />
                </div>
              ))}
            </div>
          ))
        )}

        {replyTo && (
          <div className="flex items-center gap-1.5 text-[11px] text-brand-blue ml-1">
            <Reply className="w-3 h-3" />
            <span>Replying to <strong>{replyTo.name}</strong></span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-400">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-1.5 items-center">
          <div className="shrink-0 w-6 h-6 rounded-full bg-brand-blue/20 dark:bg-brand-blue/30 flex items-center justify-center">
            <MessageCircle className="w-3 h-3 text-brand-blue" />
          </div>
          <MentionInput
            ref={inputRef}
            placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Write a comment…"}
            value={newComment}
            onChange={setNewComment}
            className="h-7 text-[11px] bg-gray-50 dark:bg-gray-900 dark:border-gray-700 border-gray-200 rounded-full flex-1 px-3"
            maxLength={1000}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newComment.trim() || sending}
            className="h-7 w-7 p-0 rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ─── Post Card ────────────────────────────────────────── */

interface MySharePostCardProps {
  post: MySharePost;
  onLike: () => void;
  onDelete: () => void;
  onFetchComments: (postId: string) => Promise<MyShareComment[]>;
  onAddComment: (postId: string, content: string, parentId?: string) => Promise<MyShareComment>;
  onToggleCommentLike: (postId: string, commentId: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  canDelete: boolean;
}

export function MySharePostCard({
  post,
  onLike,
  onDelete,
  onFetchComments,
  onAddComment,
  onToggleCommentLike,
  onDeleteComment,
  canDelete,
}: MySharePostCardProps) {
  const { playPop, playClick } = useSounds();
  const [showMenu, setShowMenu] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showCommentThread, setShowCommentThread] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionClamped, setCaptionClamped] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const photoUrl = getPhotoUrl(post.authorEmail, post.authorName);

  // Detect if caption is actually clamped
  useEffect(() => {
    const el = captionRef.current;
    if (el) {
      setCaptionClamped(el.scrollHeight > el.clientHeight + 1);
    }
  }, [post.caption]);

  const handleLike = () => {
    playPop();
    onLike();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
    >
      {/* Main content row: Left (content) | Right (portrait image) */}
      <div className="flex items-start">
        {/* Left column: author, caption, reactions, comments preview */}
        <div className="flex-1 min-w-0 p-2.5 flex flex-col">
          {/* Author Header */}
          <div className="flex items-center gap-2 pb-1.5">
            <Avatar className="h-8 w-8 ring-2 ring-gray-100 dark:ring-gray-700">
              <AvatarImage src={photoUrl} alt={post.authorName} />
              <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[10px] font-bold">
                {getInitials(post.authorName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 leading-tight truncate">
                {post.authorName}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {getRelativeTime(post.createdAt)}
              </p>
            </div>
            {canDelete && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-8 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDelete();
                        }}
                        className="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/60">
              <p
                ref={captionRef}
                className={`text-[12px] text-gray-700 dark:text-gray-300 leading-snug whitespace-pre-wrap break-words ${!captionExpanded ? "line-clamp-3" : ""}`}
              >
                {renderMentionContent(post.caption)}
              </p>
              {captionClamped && !captionExpanded && (
                <button
                  type="button"
                  onClick={() => setCaptionExpanded(true)}
                  className="text-[11px] font-semibold text-brand-blue hover:underline mt-0.5"
                >
                  more
                </button>
              )}
            </div>
          )}

          {/* Heart + count */}
          <div className="pb-2">
            <button
              onClick={handleLike}
              className="flex items-center gap-1.5 group/like transition-colors"
            >
              <Heart className={`w-5 h-5 transition-all ${
                post.userLiked
                  ? "fill-rose-500 text-rose-500 scale-110"
                  : "text-gray-600 dark:text-gray-400 group-hover/like:text-rose-500"
              }`} />
              {post.likeCount > 0 && (
                <span className={`text-[13px] font-semibold tabular-nums ${
                  post.userLiked ? "text-rose-500" : "text-gray-600 dark:text-gray-400"
                }`}>
                  {post.likeCount}
                </span>
              )}
            </button>
          </div>

          {/* Comments preview (oldest first, fading out — hidden when thread is open) */}
          {!showCommentThread && (post.previewComments?.length ?? 0) > 0 && (
            <div className="relative flex-1 min-h-[32px] mb-1 overflow-hidden">
              <div
                className="space-y-1 h-full"
                style={{
                  maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)",
                }}
              >
                {post.previewComments!.map((c) => (
                  <p key={c.id} className="text-[11px] text-gray-600 dark:text-gray-400 leading-snug truncate">
                    <span className="font-bold text-gray-800 dark:text-gray-200 mr-1">{c.authorName}</span>
                    {renderMentionContent(c.content)}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* View all comments button */}
          {post.commentCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCommentThread((v) => !v)}
              className="text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors text-left"
            >
              {showCommentThread ? "Hide comments" : `View all ${post.commentCount} comment${post.commentCount !== 1 ? "s" : ""}`}
            </button>
          )}
          {post.commentCount === 0 && (
            <button
              type="button"
              onClick={() => setShowCommentThread((v) => !v)}
              className="text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors text-left"
            >
              {showCommentThread ? "Hide comments" : "Add a comment…"}
            </button>
          )}

          {/* Inline Comment Thread (expands inside card) */}
          <AnimatePresence>
            {showCommentThread && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-2"
              >
                <InlineCommentThread
                  postId={post.id}
                  commentCount={post.commentCount}
                  fetchComments={onFetchComments}
                  addComment={onAddComment}
                  toggleCommentLike={onToggleCommentLike}
                  deleteComment={onDeleteComment}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right column: portrait image (9:16 aspect) */}
        {post.media.length > 0 && (
          <div
            className="shrink-0 w-[120px] aspect-[9/13] overflow-hidden cursor-pointer group/thumb relative"
            onClick={() => setLightboxIndex(0)}
          >
            {post.media[0].mimeType?.startsWith("video/") ? (
              <video
                src={post.media[0].fileUrl}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={post.media[0].fileUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
              <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover/thumb:opacity-80 transition-opacity drop-shadow-lg" />
            </div>
            {post.media.length > 1 && (
              <div className="absolute top-1.5 right-1.5 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[9px] text-white font-medium">
                +{post.media.length - 1}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <MediaLightbox
            media={post.media}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            post={post}
            onLike={onLike}
            fetchComments={onFetchComments}
            addComment={onAddComment}
            toggleCommentLike={onToggleCommentLike}
            deleteComment={onDeleteComment}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
