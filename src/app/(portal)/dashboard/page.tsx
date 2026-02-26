// ProConnect — Main Employee Dashboard (Server Component)
// Fetches lightweight dashboard settings from the DB at render time.
// Only passes boolean visibility flags + slider config (no base64 media blobs).
// The client component fetches slider media separately if needed.

import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

interface SliderConfig {
  enabled: boolean;
  hasMedia: boolean;
  height: number;
  transitionMs: number;
  style: "slide" | "fade";
}

const DEFAULT_VIS = { showCompanyPillars: true, showTournamentBracketLive: true };
const DEFAULT_SLIDER_CONFIG: SliderConfig = {
  enabled: false,
  hasMedia: false,
  height: 240,
  transitionMs: 4000,
  style: "slide",
};

export default async function DashboardPage() {
  let visibility = DEFAULT_VIS;
  let sliderConfig: SliderConfig = DEFAULT_SLIDER_CONFIG;

  try {
    const [visSetting, sliderSetting] = await Promise.all([
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_visibility" } }),
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_slider" } }),
    ]);

    if (visSetting?.data) {
      try {
        const parsed = JSON.parse(visSetting.data) as Record<string, unknown>;
        visibility = {
          showCompanyPillars: parsed.showCompanyPillars !== false,
          showTournamentBracketLive: parsed.showTournamentBracketLive !== false,
        };
      } catch {
        /* keep defaults */
      }
    }

    if (sliderSetting?.data) {
      try {
        const raw = JSON.parse(sliderSetting.data) as Record<string, unknown>;
        const mediaArr = Array.isArray(raw.media) ? raw.media : [];
        const legacyArr = Array.isArray(raw.images) ? raw.images : [];
        const hasMedia = mediaArr.length > 0 || legacyArr.length > 0;
        sliderConfig = {
          enabled: raw.enabled === true,
          hasMedia,
          height: Number.isFinite(raw.height)
            ? Math.max(120, Math.min(720, Number(raw.height)))
            : 240,
          transitionMs: Number.isFinite(raw.transitionMs)
            ? Math.max(1000, Math.min(30000, Number(raw.transitionMs)))
            : 4000,
          style: raw.style === "fade" ? "fade" : "slide",
        };
      } catch {
        /* keep defaults */
      }
    }
  } catch (e) {
    console.error("Failed to load dashboard settings:", e);
  }

  return <DashboardClient visibility={visibility} sliderConfig={sliderConfig} />;
}
