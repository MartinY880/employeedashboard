// ProConnect — Admin Dashboard Slider Management
// Full CRUD for the dashboard slider: show/hide, media upload, height, transition, style

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Loader2,
  ImageIcon,
  Check,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface DashboardSliderMedia {
  type: "image" | "video";
  src: string;
}

interface DashboardSliderSettings {
  enabled: boolean;
  media: DashboardSliderMedia[];
  height: number;
  transitionMs: number;
  style: "slide" | "fade";
  objectFit: "cover" | "contain" | "fill";
}

const DEFAULT_DASHBOARD_SLIDER: DashboardSliderSettings = {
  enabled: false,
  media: [],
  height: 240,
  transitionMs: 4000,
  style: "slide",
  objectFit: "cover",
};

function normalizeDashboardSliderSettings(input: unknown): DashboardSliderSettings {
  const raw = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};

  const parsedMedia = Array.isArray(raw.media)
    ? raw.media
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const value = item as Record<string, unknown>;
          const src = String(value.src || "").trim();
          if (!src) return null;
          return { type: value.type === "video" ? "video" : "image", src } as DashboardSliderMedia;
        })
        .filter((item): item is DashboardSliderMedia => item !== null)
    : [];

  const legacyImages = Array.isArray(raw.images)
    ? raw.images
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .map((src) => ({ type: "image", src } as DashboardSliderMedia))
    : [];

  return {
    enabled: raw.enabled === true,
    media: parsedMedia.length > 0 ? parsedMedia : legacyImages,
    height: Number.isFinite(raw.height) ? Math.max(120, Math.min(720, Number(raw.height))) : DEFAULT_DASHBOARD_SLIDER.height,
    transitionMs: Number.isFinite(raw.transitionMs) ? Math.max(1000, Math.min(30000, Number(raw.transitionMs))) : DEFAULT_DASHBOARD_SLIDER.transitionMs,
    style: raw.style === "fade" ? "fade" : "slide",
    objectFit: (raw.objectFit === "contain" || raw.objectFit === "fill") ? raw.objectFit : "cover",
  };
}

export default function AdminSliderPage() {
  const [slider, setSlider] = useState<DashboardSliderSettings>(DEFAULT_DASHBOARD_SLIDER);
  const [initialSlider, setInitialSlider] = useState<DashboardSliderSettings>(DEFAULT_DASHBOARD_SLIDER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [heightInput, setHeightInput] = useState(String(DEFAULT_DASHBOARD_SLIDER.height));

  const hasChanges = JSON.stringify(slider) !== JSON.stringify(initialSlider);

  const fetchSlider = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard-settings");
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeDashboardSliderSettings(data.slider);
        setSlider(normalized);
        setInitialSlider(normalized);
        setHeightInput(String(normalized.height));
      }
    } catch { /* keep defaults */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchSlider(); }, [fetchSlider]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/dashboard-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "dashboardSlider", value: slider }),
      });
      if (res.ok) {
        const data = await res.json();
        const saved = normalizeDashboardSliderSettings(data.slider);
        setSlider(saved);
        setInitialSlider(saved);
        setHeightInput(String(saved.height));
        toast.success("Dashboard slider saved!");
      } else {
        toast.error("Failed to save slider settings");
      }
    } catch {
      toast.error("Failed to save slider settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function readFilesAsDataUrls(files: File[]) {
    const readers = files.map((file) =>
      new Promise<DashboardSliderMedia>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          type: file.type.startsWith("video/") ? "video" : "image",
          src: String(reader.result || ""),
        });
        reader.onerror = () => reject(new Error("Failed to read media"));
        reader.readAsDataURL(file);
      })
    );
    return Promise.all(readers);
  }

  async function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    for (const file of selected) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        toast.error("All slider files must be image or video files");
        e.target.value = "";
        return;
      }
    }

    try {
      const mediaDataUrls = await readFilesAsDataUrls(selected);
      setSlider((prev) => ({
        ...prev,
        media: [...prev.media, ...mediaDataUrls],
      }));
    } catch {
      toast.error("Failed to process one or more media files");
    } finally {
      e.target.value = "";
    }
  }

  function handleRemoveMedia(index: number) {
    setSlider((prev) => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
    }));
  }

  function moveMedia(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setSlider((prev) => {
      if (fromIndex >= prev.media.length || toIndex >= prev.media.length) return prev;
      const nextMedia = [...prev.media];
      const [moved] = nextMedia.splice(fromIndex, 1);
      nextMedia.splice(toIndex, 0, moved);
      return { ...prev, media: nextMedia };
    });
  }

  if (isLoading) {
    return (
      <div className="max-w-[900px] mx-auto px-6 py-6 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[900px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-brand-blue hover:border-brand-blue/30 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Slider</h1>
            <p className="text-sm text-brand-grey">
              Manage the full-width dashboard slider shown to all users
            </p>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="min-w-[140px] bg-brand-blue hover:bg-brand-blue/90"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Show/Hide Toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Show slider on dashboard</p>
            <p className="text-xs text-brand-grey">Global show/hide for all users</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSlider((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={!slider.enabled ? "border-red-200 text-red-600 hover:bg-red-50" : ""}
          >
            {slider.enabled ? (
              <>
                <Eye className="w-4 h-4 mr-1.5" />
                Visible
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 mr-1.5" />
                Hidden
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Slider Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Slider Settings</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Height (px)</label>
            <Input
              type="number"
              min={120}
              max={720}
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              onBlur={() => {
                const value = Number(heightInput);
                if (Number.isFinite(value)) {
                  const clamped = Math.max(120, Math.min(720, Math.round(value)));
                  setSlider((prev) => ({ ...prev, height: clamped }));
                  setHeightInput(String(clamped));
                } else {
                  setHeightInput(String(slider.height));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Transition Time (ms)</label>
            <Input
              type="number"
              min={1000}
              max={30000}
              step={250}
              value={slider.transitionMs}
              onChange={(e) => {
                const value = Number(e.target.value);
                setSlider((prev) => ({
                  ...prev,
                  transitionMs: Number.isFinite(value) ? Math.max(1000, Math.min(30000, value)) : prev.transitionMs,
                }));
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Transition Style</label>
            <Select
              value={slider.style}
              onValueChange={(value: "slide" | "fade") =>
                setSlider((prev) => ({ ...prev, style: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slide">Slide</SelectItem>
                <SelectItem value="fade">Fade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Image Fit</label>
            <Select
              value={slider.objectFit}
              onValueChange={(value: "cover" | "contain" | "fill") =>
                setSlider((prev) => ({ ...prev, objectFit: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select fit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover (crop to fill)</SelectItem>
                <SelectItem value="contain">Contain (fit, no crop)</SelectItem>
                <SelectItem value="fill">Fill (stretch to fit)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Slider Media */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Slider Media ({slider.media.length})
          </h2>
          <label>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleMediaSelect}
            />
            <span className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground cursor-pointer">
              <Upload className="w-4 h-4 mr-1.5" />
              Add Media
            </span>
          </label>
        </div>
        <p className="text-xs text-brand-grey mb-3">
          Suggested: images under 8MB at 1920×540 (wide banner ratio); videos under 20MB at 1280×720 for best performance.
        </p>
        {slider.media.length > 1 && (
          <p className="text-xs text-brand-grey mb-3">Drag and drop items to reorder slide sequence.</p>
        )}

        {slider.media.length === 0 ? (
          <div className="text-center py-8 text-brand-grey">
            <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No media added yet</p>
            <p className="text-sm mt-1">Upload images or videos to create your dashboard slider.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {slider.media.map((mediaItem, index) => (
              <div
                key={`${index}-${mediaItem.type}-${mediaItem.src.slice(0, 24)}`}
                draggable
                onDragStart={(e) => {
                  setDraggingIndex(index);
                  setDragOverIndex(index);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggingIndex !== null) {
                    moveMedia(draggingIndex, index);
                  }
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                }}
                className={`rounded-lg border overflow-hidden bg-white transition-colors ${
                  dragOverIndex === index ? "border-brand-blue" : "border-gray-200"
                }`}
              >
                <div className="px-2.5 py-1.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <span className="text-[11px] text-gray-600 font-medium">
                    Slide {index + 1} • {mediaItem.type === "video" ? "Video" : "Image"}
                  </span>
                  <span className="inline-flex items-center text-gray-400">
                    <GripVertical className="w-4 h-4" />
                  </span>
                </div>
                {mediaItem.type === "video" ? (
                  <video
                    src={mediaItem.src}
                    className="h-28 w-full object-cover"
                    muted
                    controls
                    preload="metadata"
                  />
                ) : (
                  <img src={mediaItem.src} alt={`Slider media ${index + 1}`} className="h-28 w-full object-cover" />
                )}
                <div className="p-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleRemoveMedia(index)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
