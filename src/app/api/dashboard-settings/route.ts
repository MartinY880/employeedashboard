// ProConnect — Dashboard Settings API Route
// Lightweight endpoint for toggling individual dashboard visibility settings
// Used by /admin/pillars, /admin/tournament, and /admin/slider pages

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import {
  DEFAULT_DASHBOARD_SLIDER,
  DEFAULT_DASHBOARD_SLIDER_META,
  deriveDashboardSliderMeta,
  normalizeDashboardSliderMeta,
  normalizeDashboardSliderSettings,
  type DashboardSliderSettings,
} from "@/lib/dashboard-slider";
import { saveDashboardSliderMeta } from "@/lib/dashboard-slider-store";

interface DashboardVisibilitySettings {
  showCompanyPillars: boolean;
  showTournamentBracketLive: boolean;
}

const DEFAULT_DASHBOARD_VISIBILITY: DashboardVisibilitySettings = {
  showCompanyPillars: true,
  showTournamentBracketLive: true,
};

export async function GET() {
  try {
    const [visibilitySetting, sliderSetting, sliderMetaSetting] = await Promise.all([
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_visibility" } }),
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_slider" } }),
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_slider_meta" } }),
    ]);

    let visibility = DEFAULT_DASHBOARD_VISIBILITY;
    if (visibilitySetting?.data) {
      try {
        const parsed = JSON.parse(visibilitySetting.data) as Partial<DashboardVisibilitySettings>;
        visibility = {
          showCompanyPillars: parsed.showCompanyPillars !== false,
          showTournamentBracketLive: parsed.showTournamentBracketLive !== false,
        };
      } catch {
        visibility = DEFAULT_DASHBOARD_VISIBILITY;
      }
    }

    let slider = DEFAULT_DASHBOARD_SLIDER;
    if (sliderSetting?.data) {
      try {
        slider = normalizeDashboardSliderSettings(JSON.parse(sliderSetting.data));
      } catch {
        slider = DEFAULT_DASHBOARD_SLIDER;
      }
    }

    let sliderMeta = DEFAULT_DASHBOARD_SLIDER_META;
    if (sliderMetaSetting?.data) {
      try {
        sliderMeta = normalizeDashboardSliderMeta(JSON.parse(sliderMetaSetting.data));
      } catch {
        sliderMeta = DEFAULT_DASHBOARD_SLIDER_META;
      }
    } else {
      sliderMeta = deriveDashboardSliderMeta(slider);
      if (sliderSetting?.data) {
        try {
          await saveDashboardSliderMeta(sliderMeta);
        } catch (err) {
          console.error("Failed to backfill slider meta", err);
        }
      }
    }

    return NextResponse.json({ visibility, slider, sliderMeta });
  } catch {
    return NextResponse.json({
      visibility: DEFAULT_DASHBOARD_VISIBILITY,
      slider: DEFAULT_DASHBOARD_SLIDER,
      sliderMeta: DEFAULT_DASHBOARD_SLIDER_META,
    });
  }
}

// PATCH — update a single setting
// Body: { key: "showCompanyPillars" | "showTournamentBracketLive", value: boolean }
//   or: { key: "dashboardSlider", value: DashboardSliderSettings }
export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Any admin with pillars, tournament, or branding permissions can update their relevant setting
    const canManagePillars = hasPermission(user, PERMISSIONS.MANAGE_PILLARS);
    const canManageTournament = hasPermission(user, PERMISSIONS.MANAGE_TOURNAMENT);
    const canManageBranding = hasPermission(user, PERMISSIONS.MANAGE_BRANDING);
    const canManageSlider = hasPermission(user, PERMISSIONS.MANAGE_SLIDER);

    if (!canManagePillars && !canManageTournament && !canManageBranding && !canManageSlider) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (key === "showCompanyPillars" && canManagePillars) {
      // Read current, merge, save
      const current = await prisma.calendarSetting.findUnique({ where: { id: "dashboard_visibility" } });
      let existing = DEFAULT_DASHBOARD_VISIBILITY;
      if (current?.data) {
        try { existing = { ...DEFAULT_DASHBOARD_VISIBILITY, ...JSON.parse(current.data) }; } catch { /* keep default */ }
      }
      const updated = { ...existing, showCompanyPillars: value === true };
      await prisma.calendarSetting.upsert({
        where: { id: "dashboard_visibility" },
        update: { data: JSON.stringify(updated) },
        create: { id: "dashboard_visibility", data: JSON.stringify(updated) },
      });
      return NextResponse.json({ success: true, visibility: updated });
    }

    if (key === "showTournamentBracketLive" && canManageTournament) {
      const current = await prisma.calendarSetting.findUnique({ where: { id: "dashboard_visibility" } });
      let existing = DEFAULT_DASHBOARD_VISIBILITY;
      if (current?.data) {
        try { existing = { ...DEFAULT_DASHBOARD_VISIBILITY, ...JSON.parse(current.data) }; } catch { /* keep default */ }
      }
      const updated = { ...existing, showTournamentBracketLive: value === true };
      await prisma.calendarSetting.upsert({
        where: { id: "dashboard_visibility" },
        update: { data: JSON.stringify(updated) },
        create: { id: "dashboard_visibility", data: JSON.stringify(updated) },
      });
      return NextResponse.json({ success: true, visibility: updated });
    }

    if (key === "dashboardSlider" && canManageSlider) {
      const slider = normalizeDashboardSliderSettings(value);
      const sliderMeta = deriveDashboardSliderMeta(slider);
      await prisma.calendarSetting.upsert({
        where: { id: "dashboard_slider" },
        update: { data: JSON.stringify(slider) },
        create: { id: "dashboard_slider", data: JSON.stringify(slider) },
      });
      try {
        await saveDashboardSliderMeta(sliderMeta);
      } catch (err) {
        console.error("Failed to persist slider meta", err);
      }
      return NextResponse.json({ success: true, slider, sliderMeta });
    }

    return NextResponse.json({ error: "Invalid key or insufficient permissions" }, { status: 400 });
  } catch (err) {
    console.error("Dashboard settings PATCH error:", err);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
