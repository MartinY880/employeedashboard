// ProConnect — Dashboard Visibility-Only API
// Ultra-lightweight endpoint: returns only the two boolean visibility flags.
// No slider media, no auth required for GET. Used by admin toggle buttons.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface DashboardVisibilitySettings {
  showCompanyPillars: boolean;
  showTournamentBracketLive: boolean;
}

const DEFAULT: DashboardVisibilitySettings = {
  showCompanyPillars: true,
  showTournamentBracketLive: true,
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
