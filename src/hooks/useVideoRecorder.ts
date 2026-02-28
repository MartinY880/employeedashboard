// ProConnect — useVideoRecorder Hook
// Wraps the native MediaRecorder API with a state machine:
// idle → requesting → recording → paused → recording → stopped → preview
// Works on desktop (webcam) and mobile (device camera).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── Types ─────────────────────────────────────────────── */

export type RecorderState =
  | "idle"        // nothing happening
  | "requesting"  // awaiting getUserMedia permission
  | "previewing"  // camera open, showing live feed, not yet recording
  | "recording"   // actively recording
  | "paused"      // recording paused
  | "stopped"     // finished — blob ready for preview/upload
  | "error";      // permission denied or other failure

export interface RecorderError {
  type: "permission" | "not-supported" | "overconstrained" | "unknown";
  message: string;
}

export interface UseVideoRecorderOptions {
  /** Prefer rear camera on mobile. Default: false (selfie cam). */
  preferRearCamera?: boolean;
  /** Max recording duration in seconds. 0 = unlimited. Default: 300 (5 min). */
  maxDuration?: number;
  /** Target MIME type. Falls back to browser default. */
  mimeType?: string;
  /** Video bitrate in bits/sec. Default: 2_500_000 (2.5 Mbps). */
  videoBitsPerSecond?: number;
}

export interface VideoDeviceInfo {
  deviceId: string;
  label: string;
}

export interface UseVideoRecorderReturn {
  state: RecorderState;
  error: RecorderError | null;
  /** Live preview stream — bind to a <video> ref via srcObject */
  stream: MediaStream | null;
  /** Recorded blob after stopping */
  blob: Blob | null;
  /** Object URL for the recorded blob (for <video src=…>) */
  previewUrl: string | null;
  /** Duration of the current recording in seconds (updates every ~250ms) */
  elapsed: number;
  /** Whether the browser supports MediaRecorder */
  isSupported: boolean;
  /** Available video input devices */
  videoDevices: VideoDeviceInfo[];
  /** Currently selected device ID (empty = default) */
  selectedDeviceId: string;
  /** Change the selected video input device */
  setSelectedDeviceId: (id: string) => void;
  /** Replace the finished blob (e.g. after trimming) */
  setBlob: (blob: Blob) => void;

  /** Open camera for live preview without recording */
  openCamera: () => Promise<void>;
  /** Begin recording on the already-open camera stream */
  startRecording: () => void;
  /** Pause recording */
  pause: () => void;
  /** Resume after pause */
  resume: () => void;
  /** Stop recording → state becomes "stopped", blob is available */
  stop: () => void;
  /** Discard recording and go back to idle */
  reset: () => void;
}

/* ── Helpers ───────────────────────────────────────────── */

function pickMimeType(preferred?: string): string {
  if (preferred && MediaRecorder.isTypeSupported(preferred)) return preferred;
  // Prefer MP4 (Safari, newer Chrome), fall back to WebM
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

function getVideoConstraints(preferRear: boolean, deviceId?: string): MediaTrackConstraints {
  const base: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
  };

  // Specific device selected
  if (deviceId) {
    return { ...base, deviceId: { exact: deviceId } };
  }

  if (preferRear) {
    return { ...base, facingMode: { ideal: "environment" } };
  }
  return { ...base, facingMode: "user" };
}

/* ── Hook ──────────────────────────────────────────────── */

export function useVideoRecorder(options: UseVideoRecorderOptions = {}): UseVideoRecorderReturn {
  const {
    preferRearCamera = false,
    maxDuration = 300,
    mimeType: preferredMimeType,
    videoBitsPerSecond = 2_500_000,
  } = options;

  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [videoDevices, setVideoDevices] = useState<VideoDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);

  const isSupported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";

  // Enumerate video devices on mount (and after permission grant refreshes labels)
  const refreshDevices = useCallback(async () => {
    if (!isSupported) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${i + 1}`,
        }));
      setVideoDevices(videoInputs);
    } catch {
      // ignore — devices just won't be listed
    }
  }, [isSupported]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Stop all tracks when stream changes or on unmount
  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  // Elapsed timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const now = Date.now();
      setElapsed(pausedElapsedRef.current + (now - startTimeRef.current) / 1000);
    }, 250);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-stop when maxDuration reached
  useEffect(() => {
    if (maxDuration > 0 && elapsed >= maxDuration && state === "recording") {
      recorderRef.current?.stop();
    }
  }, [elapsed, maxDuration, state]);

  /* ── Actions ─────────────────────────────────────────── */

  // Re-open camera when device selection changes during preview
  const selectedDeviceRef = useRef(selectedDeviceId);
  useEffect(() => {
    const prev = selectedDeviceRef.current;
    selectedDeviceRef.current = selectedDeviceId;

    // Only switch if we're actively previewing and the device actually changed
    if (state === "previewing" && selectedDeviceId !== prev) {
      // Stop current stream
      stream?.getTracks().forEach((t) => t.stop());

      navigator.mediaDevices
        .getUserMedia({
          video: getVideoConstraints(preferRearCamera, selectedDeviceId || undefined),
          audio: true,
        })
        .then((mediaStream) => {
          setStream(mediaStream);
        })
        .catch(() => {
          // If the new device fails, keep current state — user can try another
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  /** Open the camera for a live preview (no recording yet). */
  const openCamera = useCallback(async () => {
    if (!isSupported) {
      setError({ type: "not-supported", message: "Video recording is not available. Make sure you are using HTTPS and a supported browser." });
      setState("error");
      return;
    }

    setState("requesting");
    setError(null);
    setBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setElapsed(0);
    pausedElapsedRef.current = 0;
    chunksRef.current = [];

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: getVideoConstraints(preferRearCamera, selectedDeviceId || undefined),
        audio: true,
      });

      // After permission grant, refresh device list to get real labels
      refreshDevices();

      setStream(mediaStream);
      setState("previewing");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";

      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError({ type: "permission", message: "Camera/microphone permission was denied." });
      } else if (msg.includes("Overconstrained") || msg.includes("OverconstrainedError")) {
        setError({ type: "overconstrained", message: "Camera does not support the requested resolution." });
      } else {
        setError({ type: "unknown", message: msg });
      }
      setState("error");
    }
  }, [isSupported, preferRearCamera, selectedDeviceId, previewUrl, refreshDevices]);

  /** Start recording on the already-open camera stream. */
  const startRecording = useCallback(() => {
    if (!stream) return;

    chunksRef.current = [];
    setElapsed(0);
    pausedElapsedRef.current = 0;

    const mimeType = pickMimeType(preferredMimeType);
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stopTimer();
      const recordedBlob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });
      setBlob(recordedBlob);
      setPreviewUrl(URL.createObjectURL(recordedBlob));
      setState("stopped");
      // Stop camera/mic tracks
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    };

    recorder.onerror = () => {
      setError({ type: "unknown", message: "Recording failed unexpectedly." });
      setState("error");
      stopTimer();
    };

    recorderRef.current = recorder;
    recorder.start(1000); // collect data every second
    setState("recording");
    startTimer();
  }, [stream, preferredMimeType, videoBitsPerSecond, startTimer, stopTimer]);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      pausedElapsedRef.current = elapsed;
      stopTimer();
      setState("paused");
    }
  }, [elapsed, stopTimer]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      startTimer();
      setState("recording");
    }
  }, [startTimer]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    // Stop recorder if active
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];

    // Release camera
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);

    // Clean up preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);

    stopTimer();
    setElapsed(0);
    pausedElapsedRef.current = 0;
    setError(null);
    setState("idle");
  }, [stream, previewUrl, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, [stopTimer]);

  return {
    state,
    error,
    stream,
    blob,
    previewUrl,
    elapsed,
    isSupported,
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    setBlob: (newBlob: Blob) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBlob(newBlob);
      setPreviewUrl(URL.createObjectURL(newBlob));
    },
    openCamera,
    startRecording,
    pause,
    resume,
    stop,
    reset,
  };
}
