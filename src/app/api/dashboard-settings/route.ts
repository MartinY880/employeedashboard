// ProConnect — Dashboard Settings API Route
// Lightweight endpoint for toggling individual dashboard visibility settings
// Used by /admin/pillars, /admin/tournament, and /admin/slider pages

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

interface DashboardVisibilitySettings {
  showCompanyPillars: boolean;
  showTournamentBracketLive: boolean;
}

interface DashboardSliderMedia {
  type: "image" | "video";
  src: string;
}

interface DashboardSliderSettings {
  enabled: boolean;
  media: DashboardSliderMedia[];
  height: number;
  transitionMs: number;
  style: "slide" | "fade";
}

const DEFAULT_DASHBOARD_VISIBILITY: DashboardVisibilitySettings = {
  showCompanyPillars: true,
  showTournamentBracketLive: true,
};

const DEFAULT_DASHBOARD_SLIDER: DashboardSliderSettings = {
  enabled: false,
  media: [],
  height: 240,
  transitionMs: 4000,
  style: "slide",
};

function normalizeDashboardSliderSettings(input: unknown): DashboardSliderSettings {
  const raw = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};

  const parsedMedia = Array.isArray(raw.media)
    ? raw.media
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const value = item as Record<string, unknown>;
          const src = String(value.src || "").trim();
          if (!src) return null;
          return { type: value.type === "video" ? "video" : "image", src } as DashboardSliderMedia;
        })
        .filter((item): item is DashboardSliderMedia => item !== null)
    : [];

  const legacyImages = Array.isArray(raw.images)
    ? raw.images
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .map((src) => ({ type: "image", src } as DashboardSliderMedia))
    : [];

  return {
    enabled: raw.enabled === true,
    media: parsedMedia.length > 0 ? parsedMedia : legacyImages,
    height: Number.isFinite(raw.height) ? Math.max(120, Math.min(720, Number(raw.height))) : DEFAULT_DASHBOARD_SLIDER.height,
    transitionMs: Number.isFinite(raw.transitionMs) ? Math.max(1000, Math.min(30000, Number(raw.transitionMs))) : DEFAULT_DASHBOARD_SLIDER.transitionMs,
    style: raw.style === "fade" ? "fade" : "slide",
  };
}

export async function GET() {
  try {
    const [visibilitySetting, sliderSetting] = await Promise.all([
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_visibility" } }),
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_slider" } }),
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

    return NextResponse.json({ visibility, slider });
  } catch {
    return NextResponse.json({ visibility: DEFAULT_DASHBOARD_VISIBILITY, slider: DEFAULT_DASHBOARD_SLIDER });
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

    if (!canManagePillars && !canManageTournament && !canManageBranding) {
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

    if (key === "dashboardSlider" && canManageBranding) {
      const slider = normalizeDashboardSliderSettings(value);
      await prisma.calendarSetting.upsert({
        where: { id: "dashboard_slider" },
        update: { data: JSON.stringify(slider) },
        create: { id: "dashboard_slider", data: JSON.stringify(slider) },
      });
      return NextResponse.json({ success: true, slider });
    }

    return NextResponse.json({ error: "Invalid key or insufficient permissions" }, { status: 400 });
  } catch (err) {
    console.error("Dashboard settings PATCH error:", err);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}
