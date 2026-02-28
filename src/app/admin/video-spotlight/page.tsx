// ProConnect — Admin Video Spotlight Management
// List / preview / feature / archive / delete employee videos
// Toggle widget visibility on dashboard

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  ArrowLeft,
  Loader2,
  Trash2,
  Star,
  StarOff,
  ToggleLeft,
  ToggleRight,
  Archive,
  ArchiveRestore,
  Play,
  Upload,
  Camera,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { VideoSpotlightItem, VideoSpotlightVisibility } from "@/lib/video-spotlight";
import { VideoRecorder } from "@/components/widgets/VideoRecorder";

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Filter tabs ───────────────────────────────────────── */

type FilterTab = "all" | "featured" | "active" | "archived";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "featured", label: "Featured" },
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
];

/* ── Component ─────────────────────────────────────────── */

export default function AdminVideoSpotlightPage() {
  const [videos, setVideos] = useState<VideoSpotlightItem[]>([]);
  const [visibility, setVisibility] = useState<VideoSpotlightVisibility>({ enabled: false });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  // Preview dialog
  const [previewVideo, setPreviewVideo] = useState<VideoSpotlightItem | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<VideoSpotlightItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<"choose" | "record" | "upload">("choose");

  // Edit dialog
  const [editTarget, setEditTarget] = useState<VideoSpotlightItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  /* ── Fetch videos ────────────────────────────────────── */

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/video-spotlight");
      const data = await res.json();
      setVideos(data.videos || []);
      if (data.visibility) setVisibility(data.visibility);
    } catch {
      toast.error("Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  /* ── Visibility toggle ───────────────────────────────── */

  const toggleVisibility = async () => {
    const next = !visibility.enabled;
    try {
      const res = await fetch("/api/video-spotlight", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      setVisibility({ enabled: next });
      toast.success(next ? "Video Spotlight enabled on dashboard" : "Video Spotlight hidden from dashboard");
    } catch {
      toast.error("Failed to toggle visibility");
    }
  };

  /* ── Actions ─────────────────────────────────────────── */

  const toggleFeatured = async (video: VideoSpotlightItem) => {
    try {
      const res = await fetch(`/api/video-spotlight/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !video.featured }),
      });
      if (!res.ok) throw new Error();
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, featured: !v.featured } : v))
      );
      toast.success(video.featured ? "Removed from featured" : "Added to featured");
    } catch {
      toast.error("Failed to update video");
    }
  };

  const toggleStatus = async (video: VideoSpotlightItem) => {
    const newStatus = video.status === "active" ? "archived" : "active";
    try {
      const res = await fetch(`/api/video-spotlight/${video.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, status: newStatus as "active" | "archived" } : v))
      );
      toast.success(newStatus === "archived" ? "Video archived" : "Video restored");
    } catch {
      toast.error("Failed to update video");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/video-spotlight/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Video deleted");
    } catch {
      toast.error("Failed to delete video");
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (video: VideoSpotlightItem) => {
    setEditTarget(video);
    setEditTitle(video.title);
    setEditDescription(video.description || "");
  };

  const handleEditSave = async () => {
    if (!editTarget || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/video-spotlight/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      setVideos((prev) =>
        prev.map((v) =>
          v.id === editTarget.id
            ? { ...v, title: editTitle.trim(), description: editDescription.trim() || null }
            : v
        )
      );
      setEditTarget(null);
      toast.success("Video updated");
    } catch {
      toast.error("Failed to update video");
    } finally {
      setEditSaving(false);
    }
  };

  /* ── Filtered list ───────────────────────────────────── */

  const filtered = videos.filter((v) => {
    if (filter === "featured" && !v.featured) return false;
    if (filter === "active" && v.status !== "active") return false;
    if (filter === "archived" && v.status !== "archived") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        v.title.toLowerCase().includes(q) ||
        (v.authorName || "").toLowerCase().includes(q) ||
        (v.description || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* ── Render ──────────────────────────────────────────── */

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto px-6 py-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
            <Video className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Video Spotlight</h1>
            <p className="text-sm text-brand-grey">Manage employee video recordings</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Visibility toggle */}
          <button
            onClick={toggleVisibility}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            title={visibility.enabled ? "Visible on dashboard" : "Hidden from dashboard"}
          >
            {visibility.enabled ? (
              <>
                <ToggleRight className="w-6 h-6 text-green-500" />
                <span className="hidden sm:inline">Visible</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-gray-400" />
                <span className="hidden sm:inline">Hidden</span>
              </>
            )}
          </button>

          <Button
            onClick={() => { setDialogStep("choose"); setUploadOpen(true); }}
            className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Video</span>
          </Button>
        </div>
      </div>

      {/* Filter tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author…"
            className="h-9 text-sm"
          />
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {filtered.length} video{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Video Grid */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-brand-grey">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading videos…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-brand-grey">
            <Video className="w-10 h-10 opacity-30 mb-2" />
            <p className="text-sm">
              {videos.length === 0
                ? "No videos yet. Upload one to get started."
                : "No videos match the current filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0.5 p-0.5">
            <AnimatePresence>
              {filtered.map((video) => (
                <motion.div
                  key={video.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`relative group rounded-lg border overflow-hidden transition-colors ${
                    video.status === "archived"
                      ? "border-gray-200 dark:border-gray-800 opacity-60"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {/* Thumbnail / preview area */}
                  <button
                    onClick={() => setPreviewVideo(video)}
                    className="relative w-full bg-gray-950 cursor-pointer"
                    style={{ aspectRatio: "16 / 9" }}
                  >
                    <video
                      src={`/api/video-spotlight/stream/${video.id}`}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-white/80 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-gray-900 ml-0.5" />
                      </div>
                    </div>

                    {/* Featured star */}
                    {video.featured && (
                      <div className="absolute top-2 left-2 bg-amber-400 rounded-full p-1 shadow">
                        <Star className="w-3 h-3 text-white fill-white" />
                      </div>
                    )}

                    {/* Duration */}
                    {video.duration != null && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}

                    {/* File size */}
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                      {fileSizeLabel(video.fileSize)}
                    </div>
                  </button>

                  {/* Info */}
                  <div className="p-3 bg-white dark:bg-gray-900">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => openEdit(video)}
                          className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate block w-full text-left hover:text-brand-blue transition-colors"
                          title="Click to edit"
                        >
                          {video.title}
                        </button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {video.authorName || "Unknown"} · {formatDate(video.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {video.status === "active" ? (
                          <Badge variant="default" className="bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400 hover:bg-green-100 text-[10px] px-1.5 py-0">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Archived
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={video.featured ? "Remove from featured" : "Add to featured"}
                        onClick={() => toggleFeatured(video)}
                      >
                        {video.featured ? (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        ) : (
                          <StarOff className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={video.status === "active" ? "Archive" : "Restore"}
                        onClick={() => toggleStatus(video)}
                      >
                        {video.status === "active" ? (
                          <Archive className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <ArchiveRestore className="w-3.5 h-3.5 text-green-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600"
                        title="Delete"
                        onClick={() => setDeleteTarget(video)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── New Video Dialog (multi-step wizard) ──── */}
      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) setDialogStep("choose"); }}>
        <DialogContent className="sm:max-w-lg">
          <AnimatePresence mode="wait">
            {/* Step 1: Choose method */}
            {dialogStep === "choose" && (
              <motion.div
                key="choose"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <DialogHeader>
                  <DialogTitle>New Video</DialogTitle>
                  <DialogDescription>
                    Choose how you&apos;d like to add a new video to the spotlight library.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={() => setDialogStep("upload")}
                    className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-brand-blue dark:hover:border-brand-blue bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Upload File</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">From your device</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setDialogStep("record")}
                    className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-red-400 dark:hover:border-red-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Camera className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">Start New Recording</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Use your camera</p>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 2a: Upload file mode */}
            {dialogStep === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <button
                      onClick={() => setDialogStep("choose")}
                      className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    Upload File
                  </DialogTitle>
                  <DialogDescription>
                    Select a video file from your device.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <VideoRecorder
                    mode="upload"
                    onUploadComplete={() => {
                      setUploadOpen(false);
                      setDialogStep("choose");
                      fetchVideos();
                    }}
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2b: Record mode — camera preview + device selector + Start Now */}
            {dialogStep === "record" && (
              <motion.div
                key="record"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <button
                      onClick={() => setDialogStep("choose")}
                      className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    New Recording
                  </DialogTitle>
                  <DialogDescription>
                    Select your camera input and preview it. Press &ldquo;Start Now&rdquo; when ready to record.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-2">
                  <VideoRecorder
                    mode="record"
                    autoOpenCamera
                    onUploadComplete={() => {
                      setUploadOpen(false);
                      setDialogStep("choose");
                      fetchVideos();
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ─────────────────────────────── */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          {previewVideo && (
            <>
              <div className="relative bg-black" style={{ aspectRatio: "16 / 9" }}>
                <video
                  src={`/api/video-spotlight/stream/${previewVideo.id}`}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{previewVideo.title}</h3>
                {previewVideo.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{previewVideo.description}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  By {previewVideo.authorName || "Unknown"} · {formatDate(previewVideo.createdAt)}
                  {previewVideo.duration != null && ` · ${formatDuration(previewVideo.duration)}`}
                  {` · ${fileSizeLabel(previewVideo.fileSize)}`}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
            <DialogDescription>Update the video title and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Title *
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Video title…"
                maxLength={120}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief description…"
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue resize-none text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={editSaving || !editTitle.trim()}
                className="bg-brand-blue hover:bg-brand-blue/90 text-white gap-1.5"
              >
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Video</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? The video file will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
