// ProConnect — Video Spotlight types, defaults, and normalization helpers

export type VideoSpotlightStatus = "active" | "archived";

export interface VideoSpotlightItem {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  authorId: string | null;
  authorName: string | null;
  featured: boolean;
  sortOrder: number;
  status: VideoSpotlightStatus;
  createdAt: string; // ISO string
  updatedAt: string;
}

/** Lightweight metadata for dashboard visibility checks (no file data). */
export interface VideoSpotlightMeta {
  enabled: boolean;
  featuredCount: number;
  hasFeatured: boolean;
}

/** Settings stored in CalendarSetting under key "video_spotlight_visibility". */
export interface VideoSpotlightVisibility {
  enabled: boolean;
}

/* ── Defaults ──────────────────────────────────────────── */

export const DEFAULT_VIDEO_SPOTLIGHT_VISIBILITY: VideoSpotlightVisibility = {
  enabled: false,
};

export const DEFAULT_VIDEO_SPOTLIGHT_META: VideoSpotlightMeta = {
  enabled: false,
  featuredCount: 0,
  hasFeatured: false,
};

/* ── Constraints ───────────────────────────────────────── */

/** Max upload size: 100 MB */
export const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024;

/** Accepted MIME types for upload */
export const ACCEPTED_VIDEO_TYPES = [
  "video/webm",
  "video/mp4",
  "video/quicktime",  // .mov
  "video/x-msvideo",  // .avi
  "video/x-matroska", // .mkv
] as const;

/** File extensions for the upload accept attribute */
export const ACCEPTED_VIDEO_EXTENSIONS = ".webm,.mp4,.mov,.avi,.mkv";

/* ── Normalization helpers ─────────────────────────────── */

export function normalizeVideoSpotlightStatus(value: unknown): VideoSpotlightStatus {
  return value === "archived" ? "archived" : "active";
}

export function normalizeVideoSpotlightVisibility(input: unknown): VideoSpotlightVisibility {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    enabled: raw.enabled === true,
  };
}

export function normalizeVideoSpotlightMeta(input: unknown): VideoSpotlightMeta {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const featuredCount = Number.isFinite(raw.featuredCount) ? Math.max(0, Number(raw.featuredCount)) : 0;
  return {
    enabled: raw.enabled === true,
    featuredCount,
    hasFeatured: raw.hasFeatured === true || featuredCount > 0,
  };
}

/** Serialize a Prisma VideoSpotlight row to the API-safe item shape. */
export function serializeVideoSpotlight(row: {
  id: string;
  title: string;
  description: string | null;
  filename: string;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  authorId: string | null;
  authorName: string | null;
  featured: boolean;
  sortOrder: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): VideoSpotlightItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    filename: row.filename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    duration: row.duration,
    authorId: row.authorId,
    authorName: row.authorName,
    featured: row.featured,
    sortOrder: row.sortOrder,
    status: normalizeVideoSpotlightStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
