// ProConnect — Closers Table SF Config: Force Sync
// POST → admin triggers an immediate SF sync, bypassing the refresh interval

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { runClosersTableSfSync } from "@/lib/closers-table-sync";
import type { ClosersTableSfConfig } from "@/lib/closers-table-sync";

const SF_CONFIG_ID = "closers_table_sf_config";

export async function POST() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const row = await prisma.calendarSetting.findUnique({ where: { id: SF_CONFIG_ID } });
    if (!row?.data) {
      return NextResponse.json({ error: "No SF config found — save a config first" }, { status: 400 });
    }

    const config = JSON.parse(row.data) as ClosersTableSfConfig;

    if (!config.sources?.length) {
      return NextResponse.json({ error: "No report sources configured" }, { status: 400 });
    }

    const totalAwards = await runClosersTableSfSync(config, SF_CONFIG_ID);

    return NextResponse.json({
      ok: true,
      totalAwards,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[closers-table/sf-config/refresh] POST error:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
