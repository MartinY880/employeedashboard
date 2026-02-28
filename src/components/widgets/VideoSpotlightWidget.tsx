// ProConnect — Video Spotlight Dashboard Widget
// Shows featured employee videos in a compact carousel.
// Custom player with play/pause button + scrubable timeline.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";

interface SpotlightVideo {
  id: string;
  title: string;
  description: string | null;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  authorName: string | null;
  featured: boolean;
  createdAt: string;
}

function fmtTime(seconds: number) {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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

  // Sync state from video element events
  const handlePlay = useCallback(() => setIsPlaying(true), []);
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

            {/* Info */}
            <div className="mt-2 px-0.5">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{current.title}</h4>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                {new Date(current.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
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
