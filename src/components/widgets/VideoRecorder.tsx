// ProConnect — VideoRecorder Widget
// Full self-recording component: record / pause / resume / playback / upload.
// Works on desktop (webcam) and mobile (device camera).
// Responsive: stacks vertically on mobile, side-by-side on desktop.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Pause,
  Play,
  Square,
  RotateCcw,
  Upload,
  Loader2,
  Camera,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useVideoRecorder } from "@/hooks/useVideoRecorder";
import { VideoTrimmer } from "@/components/widgets/VideoTrimmer";
import {
  MAX_VIDEO_FILE_SIZE,
  ACCEPTED_VIDEO_EXTENSIONS,
  ACCEPTED_VIDEO_TYPES,
} from "@/lib/video-spotlight";

/* ── Helpers ───────────────────────────────────────────── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Props ─────────────────────────────────────────────── */

interface VideoRecorderProps {
  /** Called after successful upload with the created video item */
  onUploadComplete?: (video: { id: string; title: string }) => void;
  /** Max seconds to record. Default: 300 (5 min). */
  maxDuration?: number;
  /** API endpoint for upload. Default: "/api/video-spotlight/upload" */
  uploadEndpoint?: string;
  /** Restrict to only recording or only upload. Default: "both" */
  mode?: "both" | "record" | "upload";
  /** Auto-open camera on mount (useful when mode="record") */
  autoOpenCamera?: boolean;
}

/* ── Component ─────────────────────────────────────────── */

export function VideoRecorder({
  onUploadComplete,
  maxDuration = 300,
  uploadEndpoint = "/api/video-spotlight/upload",
  mode = "both",
  autoOpenCamera = false,
}: VideoRecorderProps) {
  const recorder = useVideoRecorder({ maxDuration });
  const autoOpenedRef = useRef(false);

  // File upload alternative
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Trim state
  const [trimmedBlob, setTrimmedBlob] = useState<Blob | null>(null);
  const [isTrimDone, setIsTrimDone] = useState(false);

  // Live video ref — attach stream
  const liveVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-open camera when requested
  useEffect(() => {
    if (autoOpenCamera && recorder.isSupported && !autoOpenedRef.current && recorder.state === "idle") {
      autoOpenedRef.current = true;
      recorder.openCamera();
    }
  }, [autoOpenCamera, recorder]);

  useEffect(() => {
    const video = liveVideoRef.current;
    if (video && recorder.stream) {
      video.srcObject = recorder.stream;
    }
    return () => {
      if (video) video.srcObject = null;
    };
  }, [recorder.stream]);

  // Cleanup upload preview URL
  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    };
  }, [uploadPreviewUrl]);

  /* ── File upload handler ─────────────────────────────── */

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_VIDEO_TYPES.some((t) => file.type.startsWith(t.split(";")[0]))) {
      toast.error("Please select a valid video file (MP4, WebM, MOV, AVI, MKV).");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_VIDEO_FILE_SIZE) {
      toast.error(`File is too large (${fileSizeLabel(file.size)}). Maximum is ${fileSizeLabel(MAX_VIDEO_FILE_SIZE)}.`);
      e.target.value = "";
      return;
    }

    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadFile(file);
    setUploadPreviewUrl(URL.createObjectURL(file));
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }, [title, uploadPreviewUrl]);

  const clearUploadFile = useCallback(() => {
    if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl);
    setUploadFile(null);
    setUploadPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadPreviewUrl]);

  /* ── Submit (record or file) ─────────────────────────── */

  const hasContent = (isTrimDone && trimmedBlob) || (uploadFile && isTrimDone && trimmedBlob);
  const canSubmit = hasContent && title.trim().length > 0 && !isUploading;

  // Whether we should show the trimmer (blob ready, but user hasn't confirmed trim yet)
  const showTrimmer = !isTrimDone && ((recorder.state === "stopped" && recorder.blob) || (uploadFile && uploadPreviewUrl && recorder.state === "idle"));

  const handleTrimComplete = useCallback((finalBlob: Blob) => {
    setTrimmedBlob(finalBlob);
    setIsTrimDone(true);
    // If it's a recorded blob, update the recorder's blob too
    if (recorder.state === "stopped") {
      recorder.setBlob(finalBlob);
    }
  }, [recorder]);

  const handleSubmit = useCallback(async () => {
    const videoBlob = trimmedBlob || recorder.blob || uploadFile;
    if (!videoBlob || !title.trim()) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      if (videoBlob instanceof File) {
        formData.append("video", videoBlob, videoBlob.name);
      } else {
        // Blob from recorder — give it a filename
        const ext = videoBlob.type.includes("mp4") ? "mp4" : "webm";
        formData.append("video", videoBlob, `recording.${ext}`);
      }
      formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());

      const res = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Upload failed");
      }

      const data = await res.json();
      toast.success("Video uploaded successfully!");

      // Reset everything
      recorder.reset();
      clearUploadFile();
      setTitle("");
      setDescription("");
      setTrimmedBlob(null);
      setIsTrimDone(false);

      onUploadComplete?.(data.video);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }, [recorder, uploadFile, title, description, uploadEndpoint, onUploadComplete, clearUploadFile]);

  // Object URL for trimmed blob final preview
  const [trimmedPreviewUrl, setTrimmedPreviewUrl] = useState<string | null>(null);

  // Update trimmed preview URL when trimmedBlob changes
  useEffect(() => {
    if (trimmedBlob) {
      const url = URL.createObjectURL(trimmedBlob);
      setTrimmedPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setTrimmedPreviewUrl(null);
    }
  }, [trimmedBlob]);

  /* ── Derived state ───────────────────────────────────── */

  const isRecording = recorder.state === "recording";
  const isPaused = recorder.state === "paused";
  const isStopped = recorder.state === "stopped";
  const isRequesting = recorder.state === "requesting";
  const isPreviewing = recorder.state === "previewing";
  const isError = recorder.state === "error";
  const isIdle = recorder.state === "idle" && !uploadFile;
  const showLivePreview = isRecording || isPaused || isRequesting || isPreviewing;
  const showRecordedPreview = isTrimDone && trimmedBlob && (isStopped || (uploadFile && recorder.state === "idle"));

  return (
    <div className="space-y-4">
      {/* ── Video Preview Area (hidden when trimmer is active) ── */}
      {!showTrimmer && (
      <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-900"
        style={{ aspectRatio: "16 / 9" }}
      >
        <AnimatePresence mode="wait">
          {/* Live camera preview */}
          {showLivePreview && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <video
                ref={liveVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
                style={{ transform: "scaleX(-1)" }} // mirror selfie cam
              />

              {/* Live preview indicator (camera open, not recording) */}
              {isPreviewing && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
                  <span className="text-white text-xs font-semibold">Camera Ready</span>
                </div>
              )}

              {/* Recording indicator */}
              {isRecording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                  </span>
                  <span className="text-white text-xs font-mono font-semibold">
                    {formatDuration(recorder.elapsed)}
                  </span>
                </div>
              )}

              {/* Paused indicator */}
              {isPaused && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <Pause className="w-3 h-3 text-yellow-400" />
                  <span className="text-white text-xs font-mono font-semibold">
                    {formatDuration(recorder.elapsed)} — Paused
                  </span>
                </div>
              )}

              {/* Max duration warning */}
              {maxDuration > 0 && recorder.elapsed > maxDuration * 0.8 && (
                <div className="absolute top-3 right-3 bg-red-500/80 backdrop-blur-sm rounded-full px-2.5 py-1 text-white text-[10px] font-semibold">
                  {formatDuration(maxDuration - recorder.elapsed)} left
                </div>
              )}
            </motion.div>
          )}

          {/* Recorded/trimmed final preview */}
          {showRecordedPreview && trimmedPreviewUrl && (
            <motion.div
              key="recorded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              <video
                src={trimmedPreviewUrl}
                controls
                playsInline
                className="h-full w-full object-contain bg-black"
              />
            </motion.div>
          )}

          {/* Idle / empty state */}
          {isIdle && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500"
            >
              <Video className="w-12 h-12 opacity-30" />
              <p className="text-sm font-medium">{recorder.isSupported ? "Record a video or upload a file" : "Upload a video file"}</p>
            </motion.div>
          )}

          {/* Error state (skip for not-supported — handled by idle + warning) */}
          {isError && recorder.error?.type !== "not-supported" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-400"
            >
              <AlertTriangle className="w-10 h-10 opacity-60" />
              <p className="text-sm font-medium text-center px-4">{recorder.error?.message || "An error occurred"}</p>
              {recorder.error?.type === "permission" && (
                <p className="text-xs text-gray-500 text-center px-4">
                  Please allow camera and microphone access in your browser settings.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* ── Trim Timeline (shown after recording/upload, before form) ── */}
      {showTrimmer && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <VideoTrimmer
            blob={recorder.blob || uploadFile!}
            onTrimComplete={handleTrimComplete}
            label="Trim your video (drag the blue handles to adjust)"
          />
        </motion.div>
      )}

      {/* ── Controls ───────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        {/* Device selector — when idle/previewing and recording supported */}
        {recorder.isSupported && recorder.videoDevices.length > 1 && (isIdle || isError || isPreviewing) && !uploadFile && (
          <select
            value={recorder.selectedDeviceId}
            onChange={(e) => recorder.setSelectedDeviceId(e.target.value)}
            className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Default Camera</option>
            {recorder.videoDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Idle controls */}
        {(isIdle || isError) && !uploadFile && (
          <>
            {recorder.isSupported && mode !== "upload" && (
              <>
                <Button
                  onClick={recorder.openCamera}
                  disabled={isRequesting}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {isRequesting ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 mr-1.5" />
                  )}
                  Open Camera
                </Button>

                {mode === "both" && <span className="text-xs text-gray-400">or</span>}
              </>
            )}

            {mode !== "record" && (
            <label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_VIDEO_EXTENSIONS}
                className="hidden"
                onChange={handleFileSelect}
              />
              <span className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                <Upload className="w-4 h-4 mr-1.5" />
                Upload File
              </span>
            </label>
            )}
          </>
        )}

        {/* Camera preview controls — camera open but not yet recording */}
        {isPreviewing && (
          <>
            <Button
              onClick={recorder.startRecording}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <span className="relative flex h-2.5 w-2.5 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
              </span>
              Start Now
            </Button>
            <Button
              onClick={recorder.reset}
              variant="outline"
            >
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
          </>
        )}

        {/* Recording controls */}
        {isRecording && (
          <>
            <Button
              onClick={recorder.pause}
              variant="outline"
              className="border-yellow-300 text-yellow-600 hover:bg-yellow-50 dark:border-yellow-700 dark:text-yellow-400 dark:hover:bg-yellow-950/30"
            >
              <Pause className="w-4 h-4 mr-1.5" />
              Pause
            </Button>
            <Button
              onClick={recorder.stop}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Square className="w-4 h-4 mr-1.5" />
              Stop
            </Button>
          </>
        )}

        {/* Paused controls */}
        {isPaused && (
          <>
            <Button
              onClick={recorder.resume}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              <Play className="w-4 h-4 mr-1.5" />
              Resume
            </Button>
            <Button
              onClick={recorder.stop}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Square className="w-4 h-4 mr-1.5" />
              Stop
            </Button>
          </>
        )}

        {/* Post-recording controls */}
        {isStopped && (
          <Button
            onClick={() => { recorder.reset(); setTitle(""); setDescription(""); setTrimmedBlob(null); setIsTrimDone(false); }}
            variant="outline"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Re-record
          </Button>
        )}

        {/* Upload file present, idle */}
        {uploadFile && recorder.state === "idle" && (
          <Button
            onClick={() => { clearUploadFile(); setTrimmedBlob(null); setIsTrimDone(false); }}
            variant="outline"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Choose Different File
          </Button>
        )}
        </div>
      </div>

      {/* ── Title & Description + Submit ───────────────── */}
      {hasContent && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your video a title…"
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
              Description <span className="text-gray-400 dark:text-gray-600">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              maxLength={500}
            />
          </div>

          {/* File info */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {trimmedBlob && (
              <span>{fileSizeLabel(trimmedBlob.size)}{recorder.elapsed > 0 ? ` • ${formatDuration(recorder.elapsed)}` : ""}</span>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-brand-blue hover:bg-brand-blue/90"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Submit Video
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Browser support warning */}
      {!recorder.isSupported && (
        <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-3 text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Your browser doesn&apos;t support video recording. You can still upload pre-recorded video files.</span>
        </div>
      )}
    </div>
  );
}
