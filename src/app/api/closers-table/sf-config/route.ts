// ProConnect — Closers Table SF Config API
// GET    → load current SF sync config (admin)
// PUT    → save SF sync config (admin)
// DELETE → clear SF config (admin)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { extractReportId } from "@/lib/salesforce-client";
import type { ClosersTableSfConfig, ClosersTableSfSource, ClosersTableSfRank } from "@/lib/closers-table-sync";

const SF_CONFIG_ID = "closers_table_sf_config";

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const row = await prisma.calendarSetting.findUnique({ where: { id: SF_CONFIG_ID } });
    const config: ClosersTableSfConfig = row?.data
      ? (JSON.parse(row.data) as ClosersTableSfConfig)
      : { enabled: false, refreshMinutes: 15, sources: [] };

    return NextResponse.json({ config });
  } catch (err) {
    console.error("[closers-table/sf-config] GET error:", err);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Preserve lastSyncedAt from existing config
    const existing = await prisma.calendarSetting.findUnique({ where: { id: SF_CONFIG_ID } });
    const existingConfig: Partial<ClosersTableSfConfig> = existing?.data
      ? (JSON.parse(existing.data) as ClosersTableSfConfig)
      : {};

    const sources: ClosersTableSfSource[] = Array.isArray(body.sources)
      ? body.sources.map((s: Record<string, unknown>) => {
          const rawUrl = String(s.reportUrl || "");
          const take = Math.max(1, Math.min(5, Number(s.take) || 1));
          const DEFAULT_RANK_COLORS = ["#f59e0b", "#94a3b8", "#b45309", "#3b82f6", "#8b5cf6"];
          const rawRanks = Array.isArray(s.ranks) ? (s.ranks as Record<string, unknown>[]) : [];
          const ranks: ClosersTableSfRank[] = Array.from({ length: take }, (_, i) => {
            const r = rawRanks[i] ?? {};
            return {
              awardTitle: String(r.awardTitle || `#${i + 1} Closer`).slice(0, 200),
              color: String(r.color || DEFAULT_RANK_COLORS[i] || "#f59e0b").slice(0, 20),
            };
          });
          return {
            id: String(s.id || crypto.randomUUID()),
            reportUrl: rawUrl,
            reportId: String(s.reportId || extractReportId(rawUrl) || ""),
            reportName: String(s.reportName || ""),
            nameColumn: String(s.nameColumn || ""),
            emailColumn: String(s.emailColumn || ""),
            userIdColumn: String(s.userIdColumn || ""),
            take,
            awardFontSize: Math.max(8, Math.min(18, Number(s.awardFontSize) || 10)),
            ranks,
          };
        })
      : [];

    const config: ClosersTableSfConfig = {
      enabled: Boolean(body.enabled),
      refreshMinutes: Math.max(5, Math.min(120, Number(body.refreshMinutes) || 15)),
      sources,
      lastSyncedAt: existingConfig.lastSyncedAt,
      syncPaused: existingConfig.syncPaused ?? false,
    };

    await prisma.calendarSetting.upsert({
      where: { id: SF_CONFIG_ID },
      create: { id: SF_CONFIG_ID, data: JSON.stringify(config) },
      update: { data: JSON.stringify(config) },
    });

    return NextResponse.json({ ok: true, config });
  } catch (err) {
    console.error("[closers-table/sf-config] PUT error:", err);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { syncPaused } = await request.json();
    const existing = await prisma.calendarSetting.findUnique({ where: { id: SF_CONFIG_ID } });
    const existingConfig: ClosersTableSfConfig = existing?.data
      ? (JSON.parse(existing.data) as ClosersTableSfConfig)
      : { enabled: false, refreshMinutes: 15, sources: [] };

    const updated: ClosersTableSfConfig = { ...existingConfig, syncPaused: Boolean(syncPaused) };
    await prisma.calendarSetting.upsert({
      where: { id: SF_CONFIG_ID },
      create: { id: SF_CONFIG_ID, data: JSON.stringify(updated) },
      update: { data: JSON.stringify(updated) },
    });

    return NextResponse.json({ ok: true, syncPaused: updated.syncPaused });
  } catch (err) {
    console.error("[closers-table/sf-config] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.calendarSetting.deleteMany({ where: { id: SF_CONFIG_ID } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[closers-table/sf-config] DELETE error:", err);
    return NextResponse.json({ error: "Failed to clear config" }, { status: 500 });
  }
}
