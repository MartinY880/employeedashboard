// ProConnect — Rebuttal of the Day rotation logic
// Selects and rotates the active rebuttal on read; no cron needed.

import { prisma } from "@/lib/prisma";

const ROTATION_MS = 24 * 60 * 60 * 1000;

export async function getCurrentRebuttal() {
  const active = await prisma.rebuttal.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (active.length === 0) return null;

  // Find the most recently shown rebuttal — that's the current one
  const shown = active
    .filter((r) => r.lastShownAt !== null)
    .sort((a, b) => b.lastShownAt!.getTime() - a.lastShownAt!.getTime());

  const current = shown[0] ?? null;

  // Nothing ever shown — stamp the first one and start the window
  if (!current) {
    return prisma.rebuttal.update({
      where: { id: active[0].id },
      data: { lastShownAt: new Date() },
    });
  }

  const stale = Date.now() - current.lastShownAt!.getTime() > ROTATION_MS;
  if (!stale) return current;

  // --- Random rotation favoring least-recently-shown entries ---

  const pool = active.filter((r) => r.id !== current.id);

  // Only one active rebuttal — refresh its window and keep showing it
  if (pool.length === 0) {
    return prisma.rebuttal.update({
      where: { id: current.id },
      data: { lastShownAt: new Date() },
    });
  }

  // Sort by lastShownAt asc so never-shown and oldest-shown entries come first
  const sorted = [...pool].sort((a, b) => {
    if (!a.lastShownAt && !b.lastShownAt) return 0;
    if (!a.lastShownAt) return -1;
    if (!b.lastShownAt) return 1;
    return a.lastShownAt.getTime() - b.lastShownAt.getTime();
  });

  // Pick randomly from the older half to avoid recently shown entries
  const candidateCount = Math.max(1, Math.ceil(sorted.length / 2));
  const candidates = sorted.slice(0, candidateCount);
  const next = candidates[Math.floor(Math.random() * candidates.length)];

  return prisma.rebuttal.update({
    where: { id: next.id },
    data: { lastShownAt: new Date() },
  });
}
