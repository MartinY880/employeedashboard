// ProConnect — Closers Table Awards API
// GET: list active awards — auto-syncs from Salesforce when SF config is enabled and stale
// POST: create a new award (admin, manual mode)
// PATCH: update an award (admin, manual mode)
// DELETE: remove an award (admin, manual mode)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { runClosersTableSfSync } from "@/lib/closers-table-sync";
import type { ClosersTableSfConfig } from "@/lib/closers-table-sync";

const SF_CONFIG_ID = "closers_table_sf_config";

function easternToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return new Date(
    +parts.find((p) => p.type === "year")!.value,
    +parts.find((p) => p.type === "month")!.value - 1,
    +parts.find((p) => p.type === "day")!.value,
  );
}

export async function GET() {
  try {
    const today = easternToday();

    // ── Last Day To Close blackout gate ────────────────────────────────────────
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed
    const monthStartStr = `${y}-${pad(m + 1)}-01`;
    const nextMonthStr = m === 11 ? `${y + 1}-01-01` : `${y}-${pad(m + 2)}-01`;

    const lastDayEntry = await prisma.holiday.findFirst({
      where: {
        category: "important_dates",
        title: { contains: "Last Day To Close", mode: "insensitive" },
        visible: true,
        date: { gte: monthStartStr, lt: nextMonthStr },
      },
    });

    let freezeInfo: { lastDayToClose: string; frozen: boolean; manualPaused: boolean; resumesOn?: string } | null = null;

    // Check manual pause override first
    const sfRowForPause = await prisma.calendarSetting.findUnique({ where: { id: SF_CONFIG_ID } });
    const manualPaused = sfRowForPause?.data
      ? (JSON.parse(sfRowForPause.data) as ClosersTableSfConfig).syncPaused ?? false
      : false;

    if (lastDayEntry || manualPaused) {
      const storedDate = lastDayEntry ? new Date(lastDayEntry.date + "T00:00:00") : null;

      // For recurring entries: apply the day-of-month to the current month so a
      // May-resolved stored date like "2026-05-23" still correctly evaluates as
      // "June 23" in June. For one-time entries: use the stored date directly.
      let lastDayClose: Date | null = null;
      if (storedDate) {
        lastDayClose = lastDayEntry!.recurring
          ? new Date(today.getFullYear(), today.getMonth(), storedDate.getDate())
          : storedDate;
      }

      const dayOfMonth = lastDayClose?.getDate() ?? 0;
      // Last Day To Close no longer freezes the table — it must keep syncing past
      // that date so standings stay accurate. Only an explicit admin manual pause
      // can freeze updates now (and that still auto-resets on the 1st of the month).
      const isAfterClose = manualPaused;
      const isFirstOfMonth = today.getDate() === 1;

      // Format this month's Last Day To Close as YYYY-MM-DD
      const pad = (n: number) => String(n).padStart(2, "0");
      const lastDayToCloseStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(dayOfMonth)}`;
      const resumesOn = `${today.getFullYear()}-${pad(today.getMonth() + 2 > 12 ? 1 : today.getMonth() + 2)}-01`.replace(
        /^(\d{4})-13-/,
        `${today.getFullYear() + 1}-01-`,
      );

      freezeInfo = {
        lastDayToClose: lastDayToCloseStr,
        frozen: isAfterClose && !isFirstOfMonth,
        manualPaused,
        ...(isAfterClose && !isFirstOfMonth ? { resumesOn } : {}),
      };

      if (isAfterClose && !isFirstOfMonth) {
        // Blackout window: skip SF refresh, serve frozen data
        const awards = await prisma.closersTableAward.findMany({
          where: { active: true },
          orderBy: { sortOrder: "asc" },
        });
        return NextResponse.json({ awards, freezeInfo });
      }

      if (isFirstOfMonth) {
        // New month: clear stale awards + reset any manual pause so it can't persist across months
        const sfRow = await prisma.calendarSetting.findUnique({ where: { id: SF_CONFIG_ID } });
        if (sfRow?.data) {
          const cfg = JSON.parse(sfRow.data) as ClosersTableSfConfig;
          const needsAwardClear = cfg.lastSyncedAt && (() => {
            const lastSync = new Date(cfg.lastSyncedAt!);
            return lastSync.getFullYear() !== today.getFullYear() || lastSync.getMonth() !== today.getMonth();
          })();
          if (needsAwardClear || cfg.syncPaused) {
            if (needsAwardClear) await prisma.closersTableAward.deleteMany({});
            await prisma.calendarSetting.update({
              where: { id: SF_CONFIG_ID },
              data: { data: JSON.stringify({ ...cfg, syncPaused: false }) },
            });
            console.log("[closers-table] 1st of month: cleared stale awards + reset manual pause.");
          }
        }
        // Fall through to normal sync logic
      }
    }
    // ── End blackout gate ──────────────────────────────────────────────────────

    // Check for Salesforce auto-sync config
    const sfRow = await prisma.calendarSetting.findUnique({ where: { id: SF_CONFIG_ID } });
    if (sfRow?.data) {
      const sfConfig = JSON.parse(sfRow.data) as ClosersTableSfConfig;
      if (sfConfig.enabled && sfConfig.sources?.length > 0) {
        const refreshMs = (sfConfig.refreshMinutes ?? 15) * 60 * 1000;
        const isFresh =
          !!sfConfig.lastSyncedAt &&
          Date.now() - new Date(sfConfig.lastSyncedAt).getTime() < refreshMs;

        if (!isFresh) {
          try {
            await runClosersTableSfSync(sfConfig, SF_CONFIG_ID);
          } catch (err) {
            // Log but continue — return whatever is currently in the DB
            console.error("[closers-table] Auto-sync failed, serving stale data:", err);
          }
        }
      }
    }

    const awards = await prisma.closersTableAward.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ awards, freezeInfo });
  } catch (err) {
    console.error("[closers-table] GET error:", err);
    return NextResponse.json({ awards: [] });
  }
}

export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, employeeName, award, color, awardFontSize } = body;

    if (!employeeName || !award) {
      return NextResponse.json({ error: "employeeName and award are required" }, { status: 400 });
    }

    const count = await prisma.closersTableAward.count();
    const created = await prisma.closersTableAward.create({
      data: {
        employeeId: employeeId || null,
        employeeName,
        award,
        color: color || "#f59e0b",
        awardFontSize: awardFontSize || 10,
        sortOrder: count,
      },
    });

    return NextResponse.json({ award: created }, { status: 201 });
  } catch (err) {
    console.error("[closers-table] POST error:", err);
    return NextResponse.json({ error: "Failed to create award" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, employeeId, employeeName, award, color, awardFontSize, sortOrder, active } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (employeeId !== undefined) data.employeeId = employeeId || null;
    if (employeeName !== undefined) data.employeeName = employeeName;
    if (award !== undefined) data.award = award;
    if (color !== undefined) data.color = color;
    if (awardFontSize !== undefined) data.awardFontSize = awardFontSize;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;
    if (active !== undefined) data.active = active;

    const updated = await prisma.closersTableAward.update({
      where: { id },
      data,
    });

    return NextResponse.json({ award: updated });
  } catch (err) {
    console.error("[closers-table] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update award" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_CLOSERS_TABLE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await prisma.closersTableAward.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[closers-table] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete award" }, { status: 500 });
  }
}
