// ProConnect — Admin Training Videos Page
// Full CRUD: create, edit, delete, reorder, featured/active toggles

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Star,
  Pencil,
  X,
  ChevronUp,
  ChevronDown,
  Upload,
  GraduationCap,
  Video,
  Calendar,
  User,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSounds } from "@/components/shared/SoundProvider";
import { toast } from "sonner";

/* ─── Types ─────────────────────────────────────────── */

interface TrainingVideo {
  id: string;
  title: string;
  description: string | null;
  zoomUrl: string;
  thumbnailUrl: string | null;
  presenter: string | null;
  category: string;
  recordedAt: string | null;
  sortOrder: number;
  featured: boolean;
  active: boolean;
}

/* ─── Form default ───────────────────────────────────── */

const EMPTY_FORM = {
  title: "",
  zoomUrl: "",
  description: "",
  presenter: "",
  category: "General",
  recordedAt: "",
  thumbnailUrl: "",
  featured: false,
  active: true,
};

/* ─── Page component ─────────────────────────────────── */

export default function AdminTrainingVideosPage() {
  const { playClick } = useSounds();

  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const thumbInputRef = useRef<HTMLInputElement>(null);

  /* ─── Fetch ─────────────────────────────────────── */

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/training-videos?all=true");
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  /* ─── Derived ───────────────────────────────────── */

  const stats = useMemo(() => ({
    total: videos.length,
    active: videos.filter((v) => v.active).length,
    featured: videos.filter((v) => v.featured).length,
    categories: [...new Set(videos.map((v) => v.category))].length,
  }), [videos]);

  /* ─── Form helpers ──────────────────────────────── */

  function openCreate() {
    playClick();
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
    setExpandedId(null);
  }

  function openEdit(video: TrainingVideo) {
    playClick();
    setEditId(video.id);
    setForm({
      title: video.title,
      zoomUrl: video.zoomUrl,
      description: video.description || "",
      presenter: video.presenter || "",
      category: video.category,
      recordedAt: video.recordedAt ? video.recordedAt.split("T")[0] : "",
      thumbnailUrl: video.thumbnailUrl || "",
      featured: video.featured,
      active: video.active,
    });
    setShowForm(true);
    setExpandedId(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm({ ...EMPTY_FORM });
  }

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /* ─── Thumbnail upload ───────────────────────────── */

  async function handleThumbUpload(file: File) {
    setIsUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/training-videos/upload-thumbnail", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      setForm((prev) => ({ ...prev, thumbnailUrl: data.url }));
      toast.success("Thumbnail uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload thumbnail");
    } finally {
      setIsUploadingThumb(false);
    }
  }

  /* ─── CRUD ──────────────────────────────────────── */

  async function handleSave() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    if (!form.zoomUrl.trim()) { toast.error("Zoom URL is required"); return; }
    playClick();
    setIsSaving(true);

    const payload = {
      title: form.title.trim(),
      zoomUrl: form.zoomUrl.trim(),
      description: form.description.trim() || null,
      presenter: form.presenter.trim() || null,
      category: form.category.trim() || "General",
      recordedAt: form.recordedAt || null,
      thumbnailUrl: form.thumbnailUrl.trim() || null,
      featured: form.featured,
      active: form.active,
    };

    try {
      const res = editId
        ? await fetch(`/api/training-videos/${editId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/training-videos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) throw new Error();
      toast.success(editId ? "Video updated" : "Video created");
      closeForm();
      await fetchVideos();
    } catch {
      toast.error(editId ? "Failed to update video" : "Failed to create video");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(video: TrainingVideo, field: "active" | "featured") {
    playClick();
    try {
      const res = await fetch(`/api/training-videos/${video.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !video[field] }),
      });
      if (!res.ok) throw new Error();
      setVideos((prev) =>
        prev.map((v) => (v.id === video.id ? { ...v, [field]: !v[field] } : v))
      );
    } catch {
      toast.error(`Failed to toggle ${field}`);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this training video permanently?")) return;
    playClick();
    try {
      const res = await fetch(`/api/training-videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Video deleted");
      setVideos((prev) => prev.filter((v) => v.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      toast.error("Failed to delete video");
    }
  }

  /* ─── Up/Down reorder ────────────────────────────── */

  async function moveVideo(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= videos.length) return;
    playClick();

    const next = [...videos];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    const reordered = next.map((v, i) => ({ ...v, sortOrder: i }));
    setVideos(reordered);

    try {
      const res = await fetch("/api/training-videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((v) => ({ id: v.id, sortOrder: v.sortOrder })) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to save new order");
      await fetchVideos();
    }
  }

  /* ─── Loading skeleton ──────────────────────────── */

  if (isLoading) {
    return (
      <div className="max-w-[1000px] mx-auto px-6 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg mb-3 animate-pulse" />
        ))}
      </div>
    );
  }

  /* ─── Render ────────────────────────────────────── */

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1000px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-brand-blue" />
              Training Videos
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage Zoom training recordings</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-brand-blue hover:bg-brand-blue/90">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Video
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-gray-700 dark:text-gray-300" },
          { label: "Active", value: stats.active, color: "text-green-600" },
          { label: "Featured", value: stats.featured, color: "text-amber-600" },
          { label: "Categories", value: stats.categories, color: "text-blue-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Create / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                  <Video className="w-3.5 h-3.5" />
                  {editId ? "Edit Training Video" : "New Training Video"}
                </h2>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title + Zoom URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Title *</label>
                  <Input
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="e.g. Loan Origination Deep Dive"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Zoom Recording URL *</label>
                  <Input
                    value={form.zoomUrl}
                    onChange={(e) => updateField("zoomUrl", e.target.value)}
                    placeholder="https://mtgpros.zoom.us/rec/share/..."
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Brief overview of what's covered in this training..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-none"
                />
              </div>

              {/* Presenter + Category + Recorded Date */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                    <User className="w-3 h-3" /> Presenter
                  </label>
                  <Input
                    value={form.presenter}
                    onChange={(e) => updateField("presenter", e.target.value)}
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Category
                  </label>
                  <Input
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                    placeholder="e.g. Underwriting, Sales"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Recorded Date
                  </label>
                  <Input
                    type="date"
                    value={form.recordedAt}
                    onChange={(e) => updateField("recordedAt", e.target.value)}
                  />
                </div>
              </div>

              {/* Thumbnail */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Thumbnail (optional)</label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {form.thumbnailUrl ? (
                      <img
                        src={form.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/uploads/training/default-thumb.png"; }}
                      />
                    ) : (
                      <Video className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleThumbUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => thumbInputRef.current?.click()}
                      disabled={isUploadingThumb}
                      className="h-8 text-xs"
                    >
                      {isUploadingThumb ? (
                        <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-3 h-3 mr-1.5" /> {form.thumbnailUrl ? "Change" : "Upload"}</>
                      )}
                    </Button>
                    {form.thumbnailUrl && (
                      <button
                        type="button"
                        onClick={() => updateField("thumbnailUrl", "")}
                        className="text-[11px] text-red-500 hover:text-red-600 text-left"
                      >
                        Remove thumbnail
                      </button>
                    )}
                    <p className="text-[10px] text-gray-400">PNG, JPG, WebP · max 5 MB</p>
                  </div>
                </div>
              </div>

              {/* Flags */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => updateField("active", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Eye className="w-3.5 h-3.5 text-green-500" />
                  Active (visible to users)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => updateField("featured", e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  Featured (shown first)
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={closeForm}>Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-brand-blue hover:bg-brand-blue/90"
                >
                  {isSaving ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="w-4 h-4 mr-1.5" /> {editId ? "Update Video" : "Create Video"}</>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video List */}
      <div className="space-y-2">
        {videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <GraduationCap className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No training videos yet</p>
            <p className="text-xs mt-1">Click &ldquo;Add Video&rdquo; to create your first entry.</p>
          </div>
        )}

        <AnimatePresence>
          {videos.map((video, index) => {
            const isExpanded = expandedId === video.id;
            return (
              <motion.div
                key={video.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`bg-white dark:bg-gray-900 rounded-xl border shadow-sm transition-all ${
                  video.active
                    ? "border-gray-200 dark:border-gray-700"
                    : "border-gray-200 dark:border-gray-700 opacity-50"
                }`}
              >
                {/* Compact row */}
                <div className="flex items-center gap-3 p-4">
                  {/* Up/Down arrows */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => moveVideo(index, -1)}
                      disabled={index === 0}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => moveVideo(index, 1)}
                      disabled={index === videos.length - 1}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Thumbnail */}
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden border border-gray-100 dark:border-gray-700">
                    <img
                      src={video.thumbnailUrl || "/uploads/training/default-thumb.png"}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : video.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                          {video.title}
                        </h3>
                        {video.featured && (
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {video.category}
                        </span>
                        {!video.active && (
                          <Badge variant="secondary" className="text-[10px]">Hidden</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-400">
                        {video.presenter && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {video.presenter}
                          </span>
                        )}
                        {video.recordedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(video.recordedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(video, "featured")} title={video.featured ? "Unfeature" : "Feature"} className="h-8 w-8 p-0">
                      <Star className={`w-4 h-4 ${video.featured ? "text-amber-500 fill-amber-500" : "text-gray-300"}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(video, "active")} title={video.active ? "Hide" : "Show"} className="h-8 w-8 p-0">
                      {video.active ? <Eye className="w-4 h-4 text-green-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(video)} title="Edit" className="h-8 w-8 p-0">
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(video.id)} title="Delete" className="h-8 w-8 p-0 text-red-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-dashed border-gray-200 dark:border-gray-700">
                        <div className="pt-4 space-y-2 text-sm">
                          {video.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-[13px]">{video.description}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 w-24 shrink-0 text-xs font-medium">Zoom URL:</span>
                            <a
                              href={video.zoomUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-blue hover:underline text-xs break-all"
                            >
                              {video.zoomUrl}
                            </a>
                          </div>
                          {video.thumbnailUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 w-24 shrink-0 text-xs font-medium">Thumbnail:</span>
                              <a href={video.thumbnailUrl} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline text-xs">
                                View image
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {videos.length > 0 && (
        <p className="text-xs text-gray-400 text-center pt-2">
          {videos.length} video{videos.length !== 1 ? "s" : ""} · use arrows to reorder
        </p>
      )}
    </motion.div>
  );
}
