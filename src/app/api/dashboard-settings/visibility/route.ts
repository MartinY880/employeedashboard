// ProConnect — Dashboard Visibility-Only API
// Ultra-lightweight endpoint: returns only the two boolean visibility flags.
// No slider media, no auth required for GET. Used by admin toggle buttons.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

interface DashboardVisibilitySettings {
  showCompanyPillars: boolean;
  showTournamentBracketLive: boolean;
  showLenderAccountExecutives: boolean;
  showCelebrations: boolean;
}

const DEFAULT: DashboardVisibilitySettings = {
  showCompanyPillars: true,
  showTournamentBracketLive: true,
  showLenderAccountExecutives: true,
  showCelebrations: true,
};

export async function GET() {
  try {
    const row = await prisma.calendarSetting.findUnique({
      where: { id: "dashboard_visibility" },
    });

    if (row?.data) {
      try {
        const parsed = JSON.parse(row.data) as Partial<DashboardVisibilitySettings>;
        return NextResponse.json({
          showCompanyPillars: parsed.showCompanyPillars !== false,
          showTournamentBracketLive: parsed.showTournamentBracketLive !== false,
          showLenderAccountExecutives: parsed.showLenderAccountExecutives !== false,
          showCelebrations: parsed.showCelebrations !== false,
        });
      } catch {
        /* fall through to default */
      }
    }

    return NextResponse.json(DEFAULT);
  } catch {
    return NextResponse.json(DEFAULT);
  }
}

export async function PATCH(request: Request) {
  try {
    const { isAuthenticated } = await getAuthUser();
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json() as Partial<DashboardVisibilitySettings>;

    // Read current, merge, save
    const row = await prisma.calendarSetting.findUnique({
      where: { id: "dashboard_visibility" },
    });

    let current: Partial<DashboardVisibilitySettings> = {};
    if (row?.data) {
      try { current = JSON.parse(row.data); } catch { /* use empty */ }
    }

    const merged: DashboardVisibilitySettings = {
      showCompanyPillars: body.showCompanyPillars ?? current.showCompanyPillars ?? DEFAULT.showCompanyPillars,
      showTournamentBracketLive: body.showTournamentBracketLive ?? current.showTournamentBracketLive ?? DEFAULT.showTournamentBracketLive,
      showLenderAccountExecutives: body.showLenderAccountExecutives ?? current.showLenderAccountExecutives ?? DEFAULT.showLenderAccountExecutives,
      showCelebrations: body.showCelebrations ?? current.showCelebrations ?? DEFAULT.showCelebrations,
    };

    await prisma.calendarSetting.upsert({
      where: { id: "dashboard_visibility" },
      update: { data: JSON.stringify(merged) },
      create: { id: "dashboard_visibility", data: JSON.stringify(merged) },
    });

    return NextResponse.json(merged);
  } catch (err) {
    console.error("[visibility] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
