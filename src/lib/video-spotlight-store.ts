// ProConnect — Video Spotlight DB store helpers
// CRUD operations for the video_spotlights table and visibility setting.

import "server-only";
import { prisma } from "@/lib/prisma";
import {
  type VideoSpotlightItem,
  type VideoSpotlightMeta,
  type VideoSpotlightVisibility,
  DEFAULT_VIDEO_SPOTLIGHT_VISIBILITY,
  DEFAULT_VIDEO_SPOTLIGHT_META,
  normalizeVideoSpotlightVisibility,
  serializeVideoSpotlight,
} from "@/lib/video-spotlight";

const VISIBILITY_KEY = "video_spotlight_visibility";

/* ── Visibility (CalendarSetting) ──────────────────────── */

export async function getVideoSpotlightVisibility(): Promise<VideoSpotlightVisibility> {
  try {
    const row = await prisma.calendarSetting.findUnique({ where: { id: VISIBILITY_KEY } });
    if (!row?.data) return DEFAULT_VIDEO_SPOTLIGHT_VISIBILITY;
    return normalizeVideoSpotlightVisibility(JSON.parse(row.data));
  } catch {
    return DEFAULT_VIDEO_SPOTLIGHT_VISIBILITY;
  }
}

export async function setVideoSpotlightVisibility(enabled: boolean): Promise<VideoSpotlightVisibility> {
  const value: VideoSpotlightVisibility = { enabled };
  await prisma.calendarSetting.upsert({
    where: { id: VISIBILITY_KEY },
    update: { data: JSON.stringify(value) },
    create: { id: VISIBILITY_KEY, data: JSON.stringify(value) },
  });
  return value;
}

/* ── Meta (lightweight aggregate for dashboard SSR) ────── */

export async function getVideoSpotlightMeta(): Promise<VideoSpotlightMeta> {
  try {
    const [visibility, featuredCount] = await Promise.all([
      getVideoSpotlightVisibility(),
      prisma.videoSpotlight.count({ where: { featured: true, status: "active" } }),
    ]);
    return {
      enabled: visibility.enabled,
      featuredCount,
      hasFeatured: featuredCount > 0,
    };
  } catch {
    return DEFAULT_VIDEO_SPOTLIGHT_META;
  }
}

/* ── CRUD ──────────────────────────────────────────────── */

export async function listVideoSpotlights(options?: {
  featured?: boolean;
  status?: string;
}): Promise<VideoSpotlightItem[]> {
  const where: Record<string, unknown> = {};
  if (options?.featured !== undefined) where.featured = options.featured;
  if (options?.status) where.status = options.status;

  const rows = await prisma.videoSpotlight.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return rows.map(serializeVideoSpotlight);
}

export async function getVideoSpotlightById(id: string) {
  const row = await prisma.videoSpotlight.findUnique({ where: { id } });
  return row ? serializeVideoSpotlight(row) : null;
}

export async function createVideoSpotlight(data: {
  title: string;
  description?: string | null;
  filename: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number | null;
  authorId?: string | null;
  authorName?: string | null;
}): Promise<VideoSpotlightItem> {
  const row = await prisma.videoSpotlight.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      filename: data.filename,
      mimeType: data.mimeType ?? "video/webm",
      fileSize: data.fileSize ?? 0,
      duration: data.duration ?? null,
      authorId: data.authorId ?? null,
      authorName: data.authorName ?? null,
    },
  });
  return serializeVideoSpotlight(row);
}

export async function updateVideoSpotlight(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    featured: boolean;
    sortOrder: number;
    status: string;
  }>
): Promise<VideoSpotlightItem | null> {
  try {
    const row = await prisma.videoSpotlight.update({
      where: { id },
      data,
    });
    return serializeVideoSpotlight(row);
  } catch {
    return null;
  }
}

export async function deleteVideoSpotlight(id: string): Promise<boolean> {
  try {
    await prisma.videoSpotlight.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
