export type DashboardSliderStyle = "slide" | "fade";
export type DashboardSliderObjectFit = "cover" | "contain" | "fill";

export interface DashboardSliderMedia {
  type: "image" | "video";
  src: string;
  /** Optional mobile-optimized image (ignored for video). Shown on viewports < 640px. */
  mobileSrc?: string;
}

export interface DashboardSliderSettings {
  enabled: boolean;
  media: DashboardSliderMedia[];
  height: number;
  transitionMs: number;
  style: DashboardSliderStyle;
  objectFit: DashboardSliderObjectFit;
}

export interface DashboardSliderMeta {
  enabled: boolean;
  mediaCount: number;
  hasMedia: boolean;
  height: number;
  transitionMs: number;
  style: DashboardSliderStyle;
  objectFit: DashboardSliderObjectFit;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 720;
const MIN_TRANSITION = 1000;
const MAX_TRANSITION = 30000;

const clampHeight = (value: unknown) => {
  if (!Number.isFinite(value)) return 240;
  const num = Number(value);
  return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, num));
};

const clampTransition = (value: unknown) => {
  if (!Number.isFinite(value)) return 4000;
  const num = Number(value);
  return Math.max(MIN_TRANSITION, Math.min(MAX_TRANSITION, num));
};

export const DEFAULT_DASHBOARD_SLIDER: DashboardSliderSettings = {
  enabled: false,
  media: [],
  height: 240,
  transitionMs: 4000,
  style: "slide",
  objectFit: "cover",
};

export const DEFAULT_DASHBOARD_SLIDER_META: DashboardSliderMeta = {
  enabled: false,
  mediaCount: 0,
  hasMedia: false,
  height: DEFAULT_DASHBOARD_SLIDER.height,
  transitionMs: DEFAULT_DASHBOARD_SLIDER.transitionMs,
  style: DEFAULT_DASHBOARD_SLIDER.style,
  objectFit: DEFAULT_DASHBOARD_SLIDER.objectFit,
};

function normalizeMediaArray(input: unknown): DashboardSliderMedia[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const src = String(value.src || "").trim();
      if (!src) return null;
      const mobileSrc = typeof value.mobileSrc === "string" ? value.mobileSrc.trim() : undefined;
      return {
        type: value.type === "video" ? "video" : "image",
        src,
        ...(mobileSrc ? { mobileSrc } : {}),
      } satisfies DashboardSliderMedia;
    })
    .filter((item): item is DashboardSliderMedia => item !== null);
}

export function normalizeDashboardSliderSettings(input: unknown): DashboardSliderSettings {
  const raw = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
  const media = normalizeMediaArray(raw.media);
  const legacyImages = Array.isArray(raw.images)
    ? raw.images
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .map((src) => ({ type: "image", src } satisfies DashboardSliderMedia))
    : [];

  const normalizedMedia = media.length > 0 ? media : legacyImages;

  return {
    enabled: raw.enabled === true,
    media: normalizedMedia,
    height: clampHeight(raw.height),
    transitionMs: clampTransition(raw.transitionMs),
    style: raw.style === "fade" ? "fade" : "slide",
    objectFit: (raw.objectFit === "contain" || raw.objectFit === "fill") ? raw.objectFit : "cover",
  } satisfies DashboardSliderSettings;
}

export function deriveDashboardSliderMeta(settings: DashboardSliderSettings): DashboardSliderMeta {
  return {
    enabled: settings.enabled,
    mediaCount: settings.media.length,
    hasMedia: settings.media.length > 0,
    height: clampHeight(settings.height),
    transitionMs: clampTransition(settings.transitionMs),
    style: settings.style,
    objectFit: settings.objectFit,
  } satisfies DashboardSliderMeta;
}

export function normalizeDashboardSliderMeta(input: unknown): DashboardSliderMeta {
  const raw = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
  const mediaCount = Number.isFinite(raw.mediaCount) ? Math.max(0, Number(raw.mediaCount)) : 0;
  const hasMedia = raw.hasMedia === true || mediaCount > 0;

  return {
    enabled: raw.enabled === true,
    mediaCount,
    hasMedia,
    height: clampHeight(raw.height ?? DEFAULT_DASHBOARD_SLIDER_META.height),
    transitionMs: clampTransition(raw.transitionMs ?? DEFAULT_DASHBOARD_SLIDER_META.transitionMs),
    style: raw.style === "fade" ? "fade" : "slide",
    objectFit: (raw.objectFit === "contain" || raw.objectFit === "fill") ? raw.objectFit : "cover",
  } satisfies DashboardSliderMeta;
}
