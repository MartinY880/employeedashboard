// ProConnect — Closers Table SF Sync
// Shared logic used by GET /api/closers-table (lazy refresh)
// and POST /api/closers-table/sf-config/refresh (force sync)

import { prisma } from "@/lib/prisma";
import { executeReport, getSfUserEmails } from "@/lib/salesforce-client";

export interface ClosersTableSfRank {
  awardTitle: string;
  color: string;
}

export interface ClosersTableSfSource {
  id: string;
  reportUrl: string;
  reportId: string;
  reportName: string;
  nameColumn: string;
  emailColumn: string;
  userIdColumn: string;   // optional: SF User ID column (cell.value = User ID) for email lookup
  take: number;           // 1–5
  awardFontSize: number;  // shared across all ranks
  ranks: ClosersTableSfRank[]; // one per rank position (length === take)
}

export interface ClosersTableSfConfig {
  enabled: boolean;
  refreshMinutes: number;
  sources: ClosersTableSfSource[];
  lastSyncedAt?: string;
  syncPaused?: boolean;
}

// In-flight sync promise — prevents concurrent SF calls when multiple
// requests arrive simultaneously after the stale window expires.
let syncInFlight: Promise<number> | null = null;

/**
 * Pull each configured SF report, resolve emails → Entra IDs via the
 * directory snapshot, then atomically replace all closers_table_awards rows.
 * Returns the number of awards written. Concurrent callers share one in-flight
 * sync rather than each triggering their own.
 */
export async function runClosersTableSfSync(
  config: ClosersTableSfConfig,
  configId: string,
): Promise<number> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = _doSync(config, configId).finally(() => { syncInFlight = null; });
  return syncInFlight;
}

async function _doSync(
  config: ClosersTableSfConfig,
  configId: string,
): Promise<number> {
  const newAwards: Array<{
    employeeId: string | null;
    employeeName: string;
    award: string;
    color: string;
    awardFontSize: number;
    sortOrder: number;
    active: boolean;
  }> = [];

  let sortOrder = 0;

  for (const source of config.sources) {
    if (!source.reportId || !source.nameColumn) continue;

    try {
      const result = await executeReport(source.reportId);

      const nameIdx = result.columns.findIndex((c) => c.name === source.nameColumn);
      const emailIdx = source.emailColumn
        ? result.columns.findIndex((c) => c.name === source.emailColumn)
        : -1;
      const userIdIdx = source.userIdColumn
        ? result.columns.findIndex((c) => c.name === source.userIdColumn)
        : -1;

      const take = Math.max(1, Math.min(5, source.take || 1));
      const rows = result.rows.slice(0, take);

      // Collect pending rows first so we can batch-fetch SF User emails in one SOQL call
      const pending: Array<{ name: string; rawEmail: string; sfUserId: string; rankIdx: number }> = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = (
          nameIdx >= 0
            ? row.cells[nameIdx]?.label || row.cells[nameIdx]?.value || ""
            : ""
        ).trim();
        if (!name) continue;
        const rawEmail = (
          emailIdx >= 0
            ? row.cells[emailIdx]?.label || row.cells[emailIdx]?.value || ""
            : ""
        ).trim();
        // cell.value for a lookup/user field is the 15/18-char SF User ID
        const sfUserId = (
          userIdIdx >= 0 ? row.cells[userIdIdx]?.value || "" : ""
        ).trim();
        pending.push({ name, rawEmail, sfUserId, rankIdx: i });
        console.log(`[closers-table debug] source="${source.id}" name="${name}" rawEmail="${rawEmail}" sfUserId="${sfUserId}"`);
      }

      // Batch-fetch emails from Salesforce for rows that have a User ID but no email
      let sfEmailMap = new Map<string, string>();
      const idsToFetch = pending
        .filter((r) => !r.rawEmail && /^005[A-Za-z0-9]{12,15}$/.test(r.sfUserId))
        .map((r) => r.sfUserId);
      if (idsToFetch.length > 0) {
        sfEmailMap = await getSfUserEmails(idsToFetch);
      }

      // Resolve all emails → Entra directory IDs in ONE query (was an N+1:
      // one full-table scan per closer). Mirrors the celebrations route pattern.
      const emailsToResolve = pending
        .map(({ rawEmail, sfUserId }) => rawEmail || sfEmailMap.get(sfUserId) || "")
        .filter((e) => e !== "");
      const snapshots =
        emailsToResolve.length > 0
          ? await prisma.directorySnapshot.findMany({
              where: { mail: { in: emailsToResolve, mode: "insensitive" } },
              select: { id: true, mail: true },
            })
          : [];
      const idByEmail = new Map(
        snapshots.map((s) => [s.mail?.toLowerCase() ?? "", s.id])
      );

      for (const { name, rawEmail, sfUserId, rankIdx } of pending) {
        const rank = source.ranks?.[rankIdx] ?? source.ranks?.[0] ?? { awardTitle: "Top Closer", color: "#f59e0b" };
        const email = rawEmail || sfEmailMap.get(sfUserId) || "";

        // Resolve email → Entra directory ID so photo proxy works
        const employeeId = email ? idByEmail.get(email.toLowerCase()) ?? null : null;

        newAwards.push({
          employeeId,
          employeeName: name,
          award: rank.awardTitle || "Top Closer",
          color: rank.color || "#f59e0b",
          awardFontSize: source.awardFontSize || 10,
          sortOrder: sortOrder++,
          active: true,
        });
      }
    } catch (err) {
      console.warn(`[closers-table sync] Source ${source.id} ("${source.reportId}") failed:`, err);
    }
  }

  // Atomically replace all rows
  await prisma.closersTableAward.deleteMany({});
  if (newAwards.length > 0) {
    await prisma.closersTableAward.createMany({ data: newAwards });
  }

  // Stamp lastSyncedAt back into the config row
  const updated: ClosersTableSfConfig = { ...config, lastSyncedAt: new Date().toISOString() };
  await prisma.calendarSetting.update({
    where: { id: configId },
    data: { data: JSON.stringify(updated) },
  });

  return newAwards.length;
}
