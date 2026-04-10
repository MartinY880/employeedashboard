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
  Maximize,
  Minimize,
} from "lucide-react";
import { CommentSection } from "@/components/shared/CommentSection";
import type { VideoReactions, UnifiedComment } from "@/types";

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

/* ─── Comment Thread for Video ───────────────────────── */

function VideoCommentThread({ videoId, commentCount }: { videoId: string; commentCount: number }) {
  const fetchComments = useCallback(async (entityId: string): Promise<UnifiedComment[]> => {
    const res = await fetch(`/api/video-spotlight/comments?videoId=${entityId}`);
    const data = await res.json();
    return data.comments || [];
  }, []);

  const submitComment = useCallback(async (entityId: string, content: string, parentId?: string): Promise<UnifiedComment> => {
    const res = await fetch("/api/video-spotlight/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: entityId, content, parentId: parentId || null }),
    });
    const data = await res.json();
    return data.comment;
  }, []);

  const likeComment = useCallback(async (_entityId: string, commentId: string): Promise<void> => {
    await fetch("/api/video-spotlight/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
  }, []);

  const deleteComment = useCallback(async (_entityId: string, commentId: string): Promise<void> => {
    await fetch(`/api/video-spotlight/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return (
    <CommentSection
      entityId={videoId}
      commentCount={commentCount}
      onFetchComments={fetchComments}
      onSubmit={submitComment}
      onLike={likeComment}
      onDelete={deleteComment}
    />
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
  // Track whether video data has loaded (hides placeholder)
  const [videoReady, setVideoReady] = useState(false);

  // Fullscreen
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFSChange);
    return () => document.removeEventListener("fullscreenchange", handleFSChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

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
    setVideoReady(false);
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
              ref={playerContainerRef}
              className={`relative w-full rounded-lg overflow-hidden bg-gray-950 transition-all duration-300 ${isFullscreen ? "flex flex-col items-center justify-center !rounded-none" : ""}`}
              style={isFullscreen ? undefined : { aspectRatio: portraitMap[current.id] ? "9 / 16" : "16 / 9" }}
            >
              <video
                ref={videoRef}
                key={current.id}
                src={`/api/video-spotlight/stream/${current.id}`}
                playsInline
                preload="metadata"
                className={`w-full h-full object-contain ${isFullscreen ? "max-h-[calc(100vh-60px)]" : ""}`}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onLoadedData={() => setVideoReady(true)}
              />
              {/* Placeholder shown until video data loads */}
              {!videoReady && !isFullscreen && (
                <img
                  src="/proconnect-message-placeholder.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-lg"
                />
              )}

              {/* Fullscreen controls overlay */}
              {isFullscreen && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-brand-blue text-white hover:bg-brand-blue/90 transition-colors shadow-sm"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <span className="text-xs font-mono text-gray-300 min-w-[36px] tabular-nums">{fmtTime(currentTime)}</span>
                    <div
                      ref={timelineRef}
                      className="relative flex-1 h-6 flex items-center cursor-pointer group"
                      onMouseDown={handleTimelineMouseDown}
                      onTouchStart={handleTimelineTouchStart}
                      role="slider"
                      aria-label="Video timeline"
                      aria-valuenow={Math.round(currentTime)}
                      aria-valuemin={0}
                      aria-valuemax={Math.round(duration)}
                    >
                      <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/20" />
                      <div className="absolute left-0 h-1.5 rounded-full bg-brand-blue transition-[width] duration-75" style={{ width: `${progress}%` }} />
                      <div className="absolute h-4 w-4 rounded-full bg-brand-blue border-2 border-white shadow-sm -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-mono text-gray-300 min-w-[36px] tabular-nums text-right">{fmtTime(duration)}</span>
                    <button
                      onClick={toggleFullscreen}
                      className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full text-white hover:bg-white/20 transition-colors"
                      aria-label="Exit fullscreen"
                    >
                      <Minimize className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls bar (non-fullscreen) */}
            {!isFullscreen && (
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

              {/* Fullscreen button */}
              <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full text-gray-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
                aria-label="Fullscreen"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
            </div>
            )}

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
