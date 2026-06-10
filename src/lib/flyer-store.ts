// ProConnect — Flyer DB store helpers
// CRUD operations for the flyers table

import "server-only";
import { prisma } from "@/lib/prisma";

export interface FlyerItem {
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

function serialize(row: {
  id: string;
  title: string;
  filename: string;
  thumbnailFilename: string | null;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author?: { displayName: string } | null;
}): FlyerItem {
  return {
    id: row.id,
    title: row.title,
    filename: row.filename,
    thumbnailFilename: row.thumbnailFilename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    sortOrder: row.sortOrder,
    status: row.status,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    authorName: row.author?.displayName ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ── List (with optional filters) ─────────────────────── */

export async function listFlyers(options?: {
  status?: string;
  activeOnly?: boolean;
}): Promise<FlyerItem[]> {
  const where: Record<string, unknown> = {};

  if (options?.status) where.status = options.status;

  if (options?.activeOnly) {
    const now = new Date();
    where.status = "active";
    where.OR = [
      { startDate: null },
      { startDate: { lte: now } },
    ];
    where.AND = [
      {
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
    ];
  }

  const rows = await prisma.flyer.findMany({
    where,
    include: { author: { select: { displayName: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return rows.map(serialize);
}

/* ── Single ───────────────────────────────────────────── */

export async function getFlyerById(id: string): Promise<FlyerItem | null> {
  const row = await prisma.flyer.findUnique({
    where: { id },
    include: { author: { select: { displayName: true } } },
  });
  return row ? serialize(row) : null;
}

/* ── Create ───────────────────────────────────────────── */

export async function createFlyer(data: {
  title: string;
  filename: string;
  thumbnailFilename?: string | null;
  mimeType: string;
  fileSize: number;
  startDate?: Date | null;
  endDate?: Date | null;
  authorId?: string | null;
}): Promise<FlyerItem> {
  const row = await prisma.flyer.create({
    data: {
      title: data.title,
      filename: data.filename,
      thumbnailFilename: data.thumbnailFilename ?? null,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      authorId: data.authorId ?? null,
    },
    include: { author: { select: { displayName: true } } },
  });
  return serialize(row);
}

/* ── Update ───────────────────────────────────────────── */

export async function updateFlyer(
  id: string,
  data: {
    title?: string;
    status?: string;
    sortOrder?: number;
    startDate?: Date | null;
    endDate?: Date | null;
  }
): Promise<FlyerItem> {
  const row = await prisma.flyer.update({
    where: { id },
    data,
    include: { author: { select: { displayName: true } } },
  });
  return serialize(row);
}

/* ── Delete ───────────────────────────────────────────── */

export async function deleteFlyer(id: string): Promise<void> {
  await prisma.flyer.delete({ where: { id } });
}
