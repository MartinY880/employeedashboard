// ProConnect — VideoTrimmer Component
// Provides a visual trim timeline for recorded or uploaded videos.
// Uses dual-handle range slider + ffmpeg.wasm for client-side trimming.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Scissors, Loader2, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/* ── Types ─────────────────────────────────────────────── */

interface VideoTrimmerProps {
  /** Source blob to trim */
  blob: Blob;
  /** Called with the trimmed blob (or original if no trim applied) */
  onTrimComplete: (trimmedBlob: Blob) => void;
  /** Label above the trimmer */
  label?: string;
}

/* ── Helpers ───────────────────────────────────────────── */

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 10 === s % 1 ? s : s);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${secs.toString().padStart(2, "0")}.${ms}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/* ── Component ─────────────────────────────────────────── */

export function VideoTrimmer({ blob, onTrimComplete, label }: VideoTrimmerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isTrimming, setIsTrimming] = useState(false);
  const [dragging, setDragging] = useState<"start" | "end" | "playhead" | null>(null);

  // Create object URL on mount
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  // Get duration from video metadata
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Some browsers return Infinity for blob durations, so we work around it.
    if (video.duration === Infinity || isNaN(video.duration)) {
      video.currentTime = 1e10;
      video.addEventListener(
        "timeupdate",
        function handler() {
          video.removeEventListener("timeupdate", handler);
          video.currentTime = 0;
          setDuration(video.duration);
          setTrimEnd(video.duration);
        },
        { once: false }
      );
    } else {
      setDuration(video.duration);
      setTrimEnd(video.duration);
    }
  }, []);

  // Sync video time to currentTime state for the playhead
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    // Keep playback within trim bounds
    if (video.currentTime < trimStart) {
      video.currentTime = trimStart;
    }
    if (video.currentTime >= trimEnd) {
      video.pause();
      video.currentTime = trimStart;
    }
  }, [trimStart, trimEnd]);

  // When trim handles change, seek the video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !duration) return;
    if (video.currentTime < trimStart || video.currentTime > trimEnd) {
      video.currentTime = trimStart;
    }
  }, [trimStart, trimEnd, duration]);

  /* ── Drag logic for timeline handles ─────────────────── */

  const getTimeFromTrackX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || !duration) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return ratio * duration;
    },
    [duration]
  );

  const handlePointerDown = useCallback(
    (type: "start" | "end" | "playhead") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(type);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const time = getTimeFromTrackX(e.clientX);

      if (dragging === "start") {
        const newStart = clamp(time, 0, trimEnd - 0.5);
        setTrimStart(newStart);
        if (videoRef.current) videoRef.current.currentTime = newStart;
      } else if (dragging === "end") {
        const newEnd = clamp(time, trimStart + 0.5, duration);
        setTrimEnd(newEnd);
        if (videoRef.current) videoRef.current.currentTime = newEnd - 0.1;
      } else if (dragging === "playhead") {
        const t = clamp(time, trimStart, trimEnd);
        setCurrentTime(t);
        if (videoRef.current) videoRef.current.currentTime = t;
      }
    },
    [dragging, trimStart, trimEnd, duration, getTimeFromTrackX]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  /* ── Trim with ffmpeg.wasm ──────────────────────────── */

  const handleTrim = useCallback(async () => {
    // If no actual trimming needed, pass through original blob
    if (trimStart <= 0.05 && trimEnd >= duration - 0.05) {
      onTrimComplete(blob);
      return;
    }

    setIsTrimming(true);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");

      const ffmpeg = new FFmpeg();
      await ffmpeg.load();

      // Write input file
      const inputData = await fetchFile(blob);
      await ffmpeg.writeFile("input.webm", inputData);

      // Trim with re-encode for accuracy
      const trimDuration = trimEnd - trimStart;
      await ffmpeg.exec([
        "-ss",
        trimStart.toFixed(3),
        "-i",
        "input.webm",
        "-t",
        trimDuration.toFixed(3),
        "-c:v",
        "libvpx",
        "-c:a",
        "libvorbis",
        "-b:v",
        "2M",
        "-y",
        "output.webm",
      ]);

      const outputData = await ffmpeg.readFile("output.webm");
      const outputBytes = outputData instanceof Uint8Array
        ? outputData
        : new TextEncoder().encode(outputData as string);
      const trimmedBlob = new Blob([outputBytes.buffer as ArrayBuffer], { type: "video/webm" });

      ffmpeg.terminate();

      toast.success(
        `Trimmed to ${fmtTime(trimStart)} — ${fmtTime(trimEnd)} (${fmtTime(trimDuration)})`
      );
      onTrimComplete(trimmedBlob);
    } catch (err) {
      console.error("Trim failed:", err);
      toast.error("Failed to trim video. Using original instead.");
      onTrimComplete(blob);
    } finally {
      setIsTrimming(false);
    }
  }, [blob, trimStart, trimEnd, duration, onTrimComplete]);

  /* ── Reset trim ─────────────────────────────────────── */

  const resetTrim = useCallback(() => {
    setTrimStart(0);
    setTrimEnd(duration);
    if (videoRef.current) videoRef.current.currentTime = 0;
  }, [duration]);

  /* ── Derived ─────────────────────────────────────────── */

  const hasTrim = trimStart > 0.05 || (duration > 0 && trimEnd < duration - 0.05);
  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimmedDuration = trimEnd - trimStart;

  if (!objectUrl) return null;

  return (
    <div className="space-y-3">
      {label && (
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      )}

      {/* Video preview */}
      <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-black"
        style={{ aspectRatio: "16 / 9" }}
      >
        <video
          ref={videoRef}
          src={objectUrl}
          playsInline
          className="h-full w-full object-contain"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            v.paused ? v.play() : v.pause();
          }}
        />

        {/* Click to play hint */}
        <div className="absolute bottom-2 right-2 text-[10px] text-white/50 pointer-events-none">
          Click to play / pause
        </div>
      </div>

      {/* ── Trim Timeline ──────────────────────────────── */}
      {duration > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono">
            <span>{fmtTime(trimStart)}</span>
            <span className="flex items-center gap-1">
              <Scissors className="w-3 h-3" />
              {hasTrim
                ? `Trimmed: ${fmtTime(trimmedDuration)}`
                : `Full: ${fmtTime(duration)}`}
            </span>
            <span>{fmtTime(trimEnd)}</span>
          </div>

          {/* The track */}
          <div
            ref={trackRef}
            className="relative h-10 rounded-md bg-gray-200 dark:bg-gray-800 cursor-pointer select-none touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={(e) => {
              if (dragging) return;
              const t = getTimeFromTrackX(e.clientX);
              const clamped = clamp(t, trimStart, trimEnd);
              if (videoRef.current) videoRef.current.currentTime = clamped;
            }}
          >
            {/* Dimmed-out regions */}
            <div
              className="absolute inset-y-0 left-0 bg-black/30 dark:bg-black/50 rounded-l-md pointer-events-none z-[1]"
              style={{ width: `${startPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-black/30 dark:bg-black/50 rounded-r-md pointer-events-none z-[1]"
              style={{ width: `${100 - endPct}%` }}
            />

            {/* Selected (active) region */}
            <div
              className="absolute inset-y-0 bg-blue-500/20 dark:bg-blue-400/20 border-y-2 border-blue-500 dark:border-blue-400 pointer-events-none z-[2]"
              style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
            />

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-[5] cursor-ew-resize"
              style={{ left: `${playheadPct}%`, transform: "translateX(-50%)" }}
              onPointerDown={handlePointerDown("playhead")}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow-sm" />
            </div>

            {/* Start handle */}
            <div
              className="absolute top-0 bottom-0 z-[4] cursor-ew-resize flex items-center"
              style={{ left: `${startPct}%`, transform: "translateX(-50%)" }}
              onPointerDown={handlePointerDown("start")}
            >
              <div className="w-3.5 h-8 rounded-sm bg-blue-500 dark:bg-blue-400 border-2 border-blue-600 dark:border-blue-300 shadow-md hover:scale-110 transition-transform flex items-center justify-center">
                <div className="w-0.5 h-3 bg-white/80 rounded-full" />
              </div>
            </div>

            {/* End handle */}
            <div
              className="absolute top-0 bottom-0 z-[4] cursor-ew-resize flex items-center"
              style={{ left: `${endPct}%`, transform: "translateX(-50%)" }}
              onPointerDown={handlePointerDown("end")}
            >
              <div className="w-3.5 h-8 rounded-sm bg-blue-500 dark:bg-blue-400 border-2 border-blue-600 dark:border-blue-300 shadow-md hover:scale-110 transition-transform flex items-center justify-center">
                <div className="w-0.5 h-3 bg-white/80 rounded-full" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {hasTrim && (
              <Button
                onClick={resetTrim}
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            )}
            <Button
              onClick={handleTrim}
              disabled={isTrimming}
              size="sm"
              className="h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white"
            >
              {isTrimming ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Trimming…
                </>
              ) : (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  {hasTrim ? "Apply Trim" : "Use Full Video"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
