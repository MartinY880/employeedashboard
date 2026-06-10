// ProConnect — Admin Flyer Management
// Upload, schedule (start/end date), edit, archive, delete flyers

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon,
  ArrowLeft,
  Loader2,
  Trash2,
  Archive,
  ArchiveRestore,
  Plus,
  Upload,
  Calendar,
  X,
  Eye,
  ArrowUpDown,
  FileText,
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

/* ── Types ─────────────────────────────────────────────── */

interface Flyer {
  id: string;
  title: string;
  filename: string;
  thumbnailFilename: string | null;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Helpers ───────────────────────────────────────────── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().split("T")[0];
}

/* ── Filter tabs ───────────────────────────────────────── */

type FilterTab = "all" | "active" | "archived";

export default function AdminFlyersPage() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  // Upload dialog
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadStartDate, setUploadStartDate] = useState("");
  const [uploadEndDate, setUploadEndDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit dialog
  const [editFlyer, setEditFlyer] = useState<Flyer | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);

  // Preview dialog
  const [previewFlyer, setPreviewFlyer] = useState<Flyer | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Flyer | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Fetch ──────────────────────────────────────────── */

  const fetchFlyers = useCallback(async () => {
    try {
      const res = await fetch("/api/flyers");
      const data = await res.json();
      if (data.flyers) setFlyers(data.flyers);
    } catch {
      toast.error("Failed to load flyers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlyers(); }, [fetchFlyers]);

  /* ── Upload ─────────────────────────────────────────── */

  function handleFileChange(file: File | null) {
    setUploadFile(file);
    if (file) {
      // PDFs can't be previewed as <img> — use a sentinel so we show a placeholder
      const url = file.type === "application/pdf" ? "pdf" : URL.createObjectURL(file);
      setUploadPreview(url);
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, ""));
    } else {
      setUploadPreview(null);
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", uploadTitle.trim());
      fd.append("image", uploadFile);
      if (uploadStartDate) fd.append("startDate", uploadStartDate);
      if (uploadEndDate) fd.append("endDate", uploadEndDate);

      const res = await fetch("/api/flyers/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      toast.success("Flyer uploaded");
      resetUploadForm();
      fetchFlyers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function resetUploadForm() {
    setShowUpload(false);
    setUploadTitle("");
    setUploadFile(null);
    setUploadPreview(null);
    setUploadStartDate("");
    setUploadEndDate("");
  }

  /* ── Edit ────────────────────────────────────────────── */

  function openEdit(f: Flyer) {
    setEditFlyer(f);
    setEditTitle(f.title);
    setEditStartDate(toDateInput(f.startDate));
    setEditEndDate(toDateInput(f.endDate));
    setEditSortOrder(f.sortOrder);
  }

  async function handleEdit() {
    if (!editFlyer) return;
    try {
      const res = await fetch(`/api/flyers/${editFlyer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          sortOrder: editSortOrder,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success("Flyer updated");
      setEditFlyer(null);
      fetchFlyers();
    } catch {
      toast.error("Failed to update flyer");
    }
  }

  /* ── Archive / Restore ──────────────────────────────── */

  async function toggleArchive(f: Flyer) {
    const newStatus = f.status === "active" ? "archived" : "active";
    try {
      const res = await fetch(`/api/flyers/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === "archived" ? "Flyer archived" : "Flyer restored");
      fetchFlyers();
    } catch {
      toast.error("Failed to update flyer");
    }
  }

  /* ── Delete ─────────────────────────────────────────── */

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/flyers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Flyer deleted");
      setDeleteTarget(null);
      fetchFlyers();
    } catch {
      toast.error("Failed to delete flyer");
    } finally {
      setDeleting(false);
    }
  }

  /* ── Filtering ──────────────────────────────────────── */

  const filtered = flyers
    .filter((f) => {
      if (filter === "active") return f.status === "active";
      if (filter === "archived") return f.status === "archived";
      return true;
    })
    .filter((f) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return f.title.toLowerCase().includes(q) || (f.authorName?.toLowerCase().includes(q) ?? false);
    });

  /* ── Render ─────────────────────────────────────────── */

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-blue flex items-center gap-2">
              <ImageIcon className="w-6 h-6" /> Flyer Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Upload and schedule flyers for the dashboard</p>
          </div>
        </div>
        <Button onClick={() => setShowUpload(true)} className="bg-brand-blue hover:bg-brand-blue/90">
          <Plus className="w-4 h-4 mr-1.5" /> Upload Flyer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {(["all", "active", "archived"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === tab
                ? "bg-brand-blue text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search flyers…"
          className="max-w-xs ml-auto text-sm"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {flyers.length === 0 ? "No flyers uploaded yet" : "No flyers match your filter"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((f) => {
              const isActive = f.status === "active";
              const now = new Date();
              const isScheduled = f.startDate && new Date(f.startDate) > now;
              const isExpired = f.endDate && new Date(f.endDate) < now;

              return (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
                >
                  {/* Image preview */}
                  <div
                    className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 cursor-pointer group"
                    onClick={() => setPreviewFlyer(f)}
                  >
                    <img
                      src={`/api/flyers/image/${f.thumbnailFilename ?? f.filename}`}
                      alt={f.title}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye className="w-8 h-8 text-white drop-shadow" />
                    </div>
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      {isActive && <Badge className="bg-green-500/90 text-white text-[10px]">Active</Badge>}
                      {!isActive && <Badge className="bg-gray-500/90 text-white text-[10px]">Archived</Badge>}
                      {isScheduled && <Badge className="bg-yellow-500/90 text-white text-[10px]">Scheduled</Badge>}
                      {isExpired && isActive && <Badge className="bg-red-500/90 text-white text-[10px]">Expired</Badge>}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-1">{f.title}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          <ArrowUpDown className="w-2.5 h-2.5" />{f.sortOrder}
                        </span>
                        <span className="text-[10px] text-gray-400">{formatBytes(f.fileSize)}</span>
                      </div>
                    </div>

                    {(f.startDate || f.endDate) && (
                      <div className="flex items-center gap-1.5 text-[10.5px] text-gray-400">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span>
                          {f.startDate ? formatDate(f.startDate) : "—"} → {f.endDate ? formatDate(f.endDate) : "∞"}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span>By {f.authorName ?? "Unknown"}</span>
                      <span>·</span>
                      <span>{formatDate(f.createdAt)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => openEdit(f)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        onClick={() => toggleArchive(f)}
                      >
                        {isActive ? (
                          <><Archive className="w-3 h-3 mr-1" /> Archive</>
                        ) : (
                          <><ArchiveRestore className="w-3 h-3 mr-1" /> Restore</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2 text-red-500 hover:text-red-600 hover:border-red-300 ml-auto"
                        onClick={() => setDeleteTarget(f)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── Upload Dialog ─────────────────────────────── */}
      <Dialog open={showUpload} onOpenChange={(open) => { if (!open) resetUploadForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-brand-blue" /> Upload Flyer
            </DialogTitle>
            <DialogDescription>Upload a flyer image and optionally set display dates.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Title *</label>
              <Input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Spring Sale Flyer"
              />
            </div>

            {/* File picker */}
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Image *</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {uploadPreview ? (
                <div className="relative border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {uploadPreview === "pdf" ? (
                    <div className="w-full h-48 flex flex-col items-center justify-center gap-2 bg-gray-50 dark:bg-gray-800">
                      <FileText className="w-10 h-10 text-brand-blue" />
                      <span className="text-xs text-gray-500">{uploadFile?.name}</span>
                    </div>
                  ) : (
                    <img src={uploadPreview} alt="Preview" className="w-full max-h-48 object-contain bg-gray-50 dark:bg-gray-800" />
                  )}
                  <button
                    type="button"
                    onClick={() => handleFileChange(null)}
                    className="absolute top-1.5 right-1.5 p-1 bg-white dark:bg-gray-900 rounded-full shadow border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg py-8 flex flex-col items-center gap-2 hover:border-brand-blue/50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-gray-300" />
                  <span className="text-xs text-gray-400">Click to select file (JPEG, PNG, GIF, WebP, SVG, PDF)</span>
                </button>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={uploadStartDate}
                  onChange={(e) => setUploadStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={uploadEndDate}
                  onChange={(e) => setUploadEndDate(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadTitle.trim()}
              className="w-full bg-brand-blue hover:bg-brand-blue/90"
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              {uploading ? "Uploading…" : "Upload Flyer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────── */}
      <Dialog open={!!editFlyer} onOpenChange={(open) => { if (!open) setEditFlyer(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Flyer</DialogTitle>
            <DialogDescription>Update the flyer title and display dates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Sort Order</label>
              <Input
                type="number"
                min={0}
                step={1}
                value={editSortOrder}
                onChange={(e) => setEditSortOrder(Number(e.target.value))}
                placeholder="0"
              />
              <p className="text-[10px] text-gray-400 mt-1">Lower numbers display first. Default is 0.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Start Date</label>
                <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">End Date</label>
                <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleEdit} disabled={!editTitle.trim()} className="w-full bg-brand-blue hover:bg-brand-blue/90">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ────────────────────────────── */}
      <Dialog open={!!previewFlyer} onOpenChange={(open) => { if (!open) setPreviewFlyer(null); }}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
          {previewFlyer && (
            previewFlyer.mimeType === "application/pdf" ? (
              <iframe
                src={`/api/flyers/image/${previewFlyer.filename}`}
                title={previewFlyer.title}
                className="w-full h-[80vh] border-0"
              />
            ) : (
              <img
                src={`/api/flyers/image/${previewFlyer.filename}`}
                alt={previewFlyer.title}
                className="w-full max-h-[80vh] object-contain"
              />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ───────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Flyer</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete &ldquo;{deleteTarget?.title}&rdquo;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
