// ProConnect — Video Spotlight Dashboard Widget
// Shows featured employee videos in a compact carousel.
// Custom player with play/pause button + scrubable timeline.
// Like/Dislike reactions + threaded comments (mirrors Be Brilliant pattern).

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  ChevronDown,
  Send,
  Loader2,
  Trash2,
  Reply,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VideoSpotlightComment, VideoReactions } from "@/types";

interface SpotlightVideo {
  id: string;
  title: string;
  description: string | null;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  authorName: string | null;
  featured: boolean;
  playCount: number;
  createdAt: string;
  commentCount?: number;
}

function fmtTime(seconds: number) {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getTimeAgo(dateStr: string | Date): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Single Comment Bubble ──────────────────────────── */

function VideoCommentBubble({
  comment,
  onDelete,
  onLike,
  onReplyClick,
  isReply = false,
}: {
  comment: VideoSpotlightComment;
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
            <p className="text-[12px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed mt-0.5">{comment.content}</p>
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
              ) : (
                "Like"
              )}
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
            <span className="text-gray-400 dark:text-gray-500">{getTimeAgo(comment.createdAt)}</span>
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="opacity-0 group-hover/comment:opacity-100 text-gray-300 hover:text-red-500 transition-all"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Comment Thread for Video ───────────────────────── */

function VideoCommentThread({ videoId, commentCount }: { videoId: string; commentCount: number }) {
  const [comments, setComments] = useState<VideoSpotlightComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [localCount, setLocalCount] = useState(commentCount);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocalCount(commentCount); }, [commentCount]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/video-spotlight/comments?videoId=${videoId}`);
      const data = await res.json();
      setComments(data.comments || []);
      const total = (data.comments || []).reduce(
        (acc: number, c: VideoSpotlightComment) => acc + 1 + (c.replies?.length ?? 0),
        0
      );
      setLocalCount(total || commentCount);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [videoId, commentCount]);

  useEffect(() => {
    if (expanded && !loaded) fetchComments();
  }, [expanded, loaded, fetchComments]);

  // Reset when video changes
  useEffect(() => {
    setComments([]);
    setLoaded(false);
    setExpanded(false);
    setNewComment("");
    setReplyTo(null);
  }, [videoId]);

  const toggleExpanded = () => setExpanded((prev) => !prev);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/video-spotlight/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          content: newComment.trim(),
          parentId: replyTo?.id || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (replyTo) {
          setComments((prev) =>
            prev.map((c) =>
              c.id === replyTo.id
                ? { ...c, replies: [...(c.replies || []), data.comment] }
                : c
            )
          );
        } else {
          setComments((prev) => [...prev, data.comment]);
        }
        setLocalCount((c) => c + 1);
        setNewComment("");
        setReplyTo(null);
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(`/api/video-spotlight/comments?id=${commentId}`, { method: "DELETE" });
      if (res.ok) {
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
            }))
          );
          setLocalCount((c) => Math.max(0, c - 1));
        }
      }
    } catch {
      // silent
    }
  };

  const handleLike = async (commentId: string) => {
    const updateLike = (list: VideoSpotlightComment[]): VideoSpotlightComment[] =>
      list.map((c) => {
        if (c.id === commentId) {
          const liked = !c.userLiked;
          return { ...c, userLiked: liked, likes: c.likes + (liked ? 1 : -1) };
        }
        return { ...c, replies: updateLike(c.replies || []) };
      });
    setComments(updateLike);

    try {
      await fetch("/api/video-spotlight/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
    } catch {
      setComments(updateLike);
    }
  };

  const handleReplyClick = (parentId: string, authorName: string) => {
    setReplyTo({ id: parentId, name: authorName });
    inputRef.current?.focus();
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggleExpanded}
        className="mx-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-brand-blue hover:border-brand-blue/40 hover:bg-brand-blue/5 dark:hover:text-brand-blue dark:hover:border-brand-blue/40 dark:hover:bg-brand-blue/10 transition-all"
      >
        <MessageCircle className="w-4 h-4" />
        <span>{localCount > 0 ? `${localCount} comment${localCount !== 1 ? "s" : ""}` : "Comments"}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-2">
              {loading ? (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : comments.length === 0 && loaded ? (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">No comments yet — be the first!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id}>
                    <VideoCommentBubble
                      comment={c}
                      onDelete={handleDelete}
                      onLike={handleLike}
                      onReplyClick={handleReplyClick}
                    />
                    {(c.replies || []).map((r) => (
                      <div key={r.id} className="mt-1.5">
                        <VideoCommentBubble
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
                <Input
                  ref={inputRef}
                  placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Write a comment…"}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="h-7 text-[11px] bg-gray-50 dark:bg-gray-900 dark:border-gray-700 border-gray-200 rounded-full flex-1 px-3"
                  maxLength={500}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Like / Dislike Reaction Bar ────────────────────── */

function VideoReactionBar({ videoId }: { videoId: string }) {
  const [reactions, setReactions] = useState<VideoReactions>({ likes: 0, dislikes: 0, userReaction: null });
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch(`/api/video-spotlight/reactions?videoId=${videoId}`)
      .then((r) => r.json())
      .then((data) => setReactions({ likes: data.likes ?? 0, dislikes: data.dislikes ?? 0, userReaction: data.userReaction ?? null }))
      .catch(() => {});
  }, [videoId]);

  const handleReaction = async (type: "like" | "dislike") => {
    if (toggling) return;

    // Optimistic update
    setReactions((prev) => {
      const wasLiked = prev.userReaction === "like";
      const wasDisliked = prev.userReaction === "dislike";
      if (type === "like") {
        if (wasLiked) return { likes: prev.likes - 1, dislikes: prev.dislikes, userReaction: null };
        return { likes: prev.likes + 1, dislikes: prev.dislikes - (wasDisliked ? 1 : 0), userReaction: "like" };
      } else {
        if (wasDisliked) return { likes: prev.likes, dislikes: prev.dislikes - 1, userReaction: null };
        return { likes: prev.likes - (wasLiked ? 1 : 0), dislikes: prev.dislikes + 1, userReaction: "dislike" };
      }
    });

    setToggling(true);
    try {
      const res = await fetch("/api/video-spotlight/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, type }),
      });
      if (res.ok) {
        const data = await res.json();
        setReactions({ likes: data.likes, dislikes: data.dislikes, userReaction: data.userReaction });
      }
    } catch {
      // revert by refetching
      fetch(`/api/video-spotlight/reactions?videoId=${videoId}`)
        .then((r) => r.json())
        .then((data) => setReactions({ likes: data.likes ?? 0, dislikes: data.dislikes ?? 0, userReaction: data.userReaction ?? null }))
        .catch(() => {});
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleReaction("like")}
        disabled={toggling}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          reactions.userReaction === "like"
            ? "bg-brand-blue/10 text-brand-blue border border-brand-blue/30"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-transparent hover:bg-brand-blue/5 hover:text-brand-blue"
        }`}
      >
        <ThumbsUp className={`w-3.5 h-3.5 ${reactions.userReaction === "like" ? "fill-brand-blue" : ""}`} />
        {reactions.likes > 0 && <span>{reactions.likes}</span>}
      </button>
      <button
        type="button"
        onClick={() => handleReaction("dislike")}
        disabled={toggling}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
          reactions.userReaction === "dislike"
            ? "bg-red-50 dark:bg-red-950/40 text-red-500 border border-red-200 dark:border-red-800"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-transparent hover:bg-red-50 hover:text-red-500"
        }`}
      >
        <ThumbsDown className={`w-3.5 h-3.5 ${reactions.userReaction === "dislike" ? "fill-red-500" : ""}`} />
        {reactions.dislikes > 0 && <span>{reactions.dislikes}</span>}
      </button>
    </div>
  );
}

export function VideoSpotlightWidget() {
  const [videos, setVideos] = useState<SpotlightVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Track per-video orientation: true = portrait
  const [portraitMap, setPortraitMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/video-spotlight?featured=true&status=active")
      .then((r) => r.json())
      .then((data) => {
        const list: SpotlightVideo[] = data.videos || [];
        setVideos(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Reset playback state when switching videos
  const switchVideo = useCallback((newIndex: number) => {
    const vid = videoRef.current;
    if (vid) {
      vid.pause();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setActiveIndex(newIndex);
    hasCountedPlayRef.current = false;
  }, []);

  const goNext = useCallback(() => {
    switchVideo((activeIndex + 1) % videos.length);
  }, [activeIndex, videos.length, switchVideo]);

  const goPrev = useCallback(() => {
    switchVideo((activeIndex - 1 + videos.length) % videos.length);
  }, [activeIndex, videos.length, switchVideo]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, []);

  // Sync state from video element events — also increment play count
  const hasCountedPlayRef = useRef(false);
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    if (!hasCountedPlayRef.current && videos[activeIndex]) {
      hasCountedPlayRef.current = true;
      const vid = videos[activeIndex];
      // Optimistic local update
      setVideos((prev) =>
        prev.map((v) => v.id === vid.id ? { ...v, playCount: v.playCount + 1 } : v)
      );
      // Fire-and-forget server increment
      fetch(`/api/video-spotlight/${vid.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incrementPlay: true }),
      }).catch(() => {});
    }
  }, [videos, activeIndex]);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    const vid = videoRef.current;
    if (vid) vid.currentTime = 0;
  }, []);
  const handleTimeUpdate = useCallback(() => {
    if (isScrubbing) return;
    const vid = videoRef.current;
    if (vid) setCurrentTime(vid.currentTime);
  }, [isScrubbing]);
  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    setDuration(v.duration || 0);
    if (v.videoWidth && v.videoHeight) {
      setPortraitMap((prev) => ({
        ...prev,
        [videos[activeIndex]?.id ?? ""]: v.videoHeight > v.videoWidth,
      }));
    }
  }, [videos, activeIndex]);

  // ─── Timeline scrubbing ───────────────────────────────
  const seekToPosition = useCallback((clientX: number) => {
    const bar = timelineRef.current;
    const vid = videoRef.current;
    if (!bar || !vid || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = ratio * duration;
    vid.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsScrubbing(true);
    seekToPosition(e.clientX);

    const onMove = (ev: MouseEvent) => seekToPosition(ev.clientX);
    const onUp = () => {
      setIsScrubbing(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [seekToPosition]);

  const handleTimelineTouchStart = useCallback((e: React.TouchEvent) => {
    setIsScrubbing(true);
    seekToPosition(e.touches[0].clientX);

    const onMove = (ev: TouchEvent) => {
      ev.preventDefault();
      seekToPosition(ev.touches[0].clientX);
    };
    const onEnd = () => {
      setIsScrubbing(false);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  }, [seekToPosition]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
          <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="p-3">
          <div className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" style={{ aspectRatio: "16/9" }} />
          <div className="mt-2 h-4 w-3/4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Nothing to show
  if (videos.length === 0) return null;

  const current = videos[activeIndex];
  if (!current) return null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" />
              ProConnect Message
            </h3>
          </div>
          {videos.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Previous video"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 min-w-[28px] text-center">
                {activeIndex + 1}/{videos.length}
              </span>
              <button
                onClick={goNext}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Next video"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Video area */}
      <div className="p-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Player */}
            <div
              className="relative w-full rounded-lg overflow-hidden bg-gray-950 transition-all duration-300"
              style={{ aspectRatio: portraitMap[current.id] ? "9 / 16" : "16 / 9" }}
            >
              <video
                ref={videoRef}
                key={current.id}
                src={`/api/video-spotlight/stream/${current.id}`}
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
              />
            </div>

            {/* Controls bar */}
            <div className="mt-2 flex items-center gap-2">
              {/* Play / Pause button */}
              <button
                onClick={togglePlay}
                className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors shadow-sm"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 ml-0.5" />
                )}
              </button>

              {/* Time display */}
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 min-w-[32px] tabular-nums">
                {fmtTime(currentTime)}
              </span>

              {/* Scrubable timeline */}
              <div
                ref={timelineRef}
                className="relative flex-1 h-5 flex items-center cursor-pointer group"
                onMouseDown={handleTimelineMouseDown}
                onTouchStart={handleTimelineTouchStart}
                role="slider"
                aria-label="Video timeline"
                aria-valuenow={Math.round(currentTime)}
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
              >
                {/* Track background */}
                <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
                {/* Filled track */}
                <div
                  className="absolute left-0 h-1.5 rounded-full bg-brand-blue transition-[width] duration-75"
                  style={{ width: `${progress}%` }}
                />
                {/* Scrub handle */}
                <div
                  className="absolute h-3.5 w-3.5 rounded-full bg-brand-blue border-2 border-white dark:border-gray-900 shadow-sm -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progress}%` }}
                />
              </div>

              {/* Duration display */}
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 min-w-[32px] tabular-nums text-right">
                {fmtTime(duration)}
              </span>
            </div>

            {/* Info + Reactions */}
            <div className="mt-2 px-0.5">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{current.title}</h4>
              {current.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-3">{current.description}</p>
              )}
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                  <span>{new Date(current.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <Play className="w-3 h-3 fill-current" />
                    {current.playCount.toLocaleString()} {current.playCount === 1 ? "play" : "plays"}
                  </span>
                </p>
                <VideoReactionBar videoId={current.id} />
              </div>
            </div>

            {/* Comments */}
            <VideoCommentThread videoId={current.id} commentCount={current.commentCount ?? 0} />
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        {videos.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {videos.map((v, i) => (
              <button
                key={v.id}
                onClick={() => switchVideo(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === activeIndex
                    ? "bg-brand-blue"
                    : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                }`}
                aria-label={`Go to video ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
