// ProConnect — Main Employee Dashboard (Server Component)
// Fetches lightweight dashboard settings from the DB at render time.
// Only passes boolean visibility flags + slider config (no base64 media blobs).
// The client component fetches slider media separately if needed.

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DASHBOARD_SLIDER_META,
  deriveDashboardSliderMeta,
  normalizeDashboardSliderMeta,
  normalizeDashboardSliderSettings,
} from "@/lib/dashboard-slider";
import { saveDashboardSliderMeta } from "@/lib/dashboard-slider-store";
import { getVideoSpotlightMeta } from "@/lib/video-spotlight-store";
import DashboardClient from "./DashboardClient";

interface SliderConfig {
  enabled: boolean;
  hasMedia: boolean;
  height: number;
  transitionMs: number;
  style: "slide" | "fade";
  objectFit: "cover" | "contain" | "fill";
}

const DEFAULT_VIS = { showCompanyPillars: true, showTournamentBracketLive: true };
const DEFAULT_SLIDER_CONFIG: SliderConfig = {
  enabled: false,
  hasMedia: false,
  height: 240,
  transitionMs: 4000,
  style: "slide",
  objectFit: "cover",
};

export default async function DashboardPage() {
  let visibility = DEFAULT_VIS;
  let sliderConfig: SliderConfig = DEFAULT_SLIDER_CONFIG;
  let showVideoSpotlight = false;

  try {
    const [visSetting, sliderMetaSetting, videoMeta] = await Promise.all([
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_visibility" } }),
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_slider_meta" } }),
      getVideoSpotlightMeta(),
    ]);

    showVideoSpotlight = videoMeta.enabled && videoMeta.hasFeatured;

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
    let sliderMeta = DEFAULT_DASHBOARD_SLIDER_META;
    if (sliderMetaSetting?.data) {
      try {
        sliderMeta = normalizeDashboardSliderMeta(JSON.parse(sliderMetaSetting.data));
      } catch {
        sliderMeta = DEFAULT_DASHBOARD_SLIDER_META;
      }
    } else {
      const sliderSetting = await prisma.calendarSetting.findUnique({ where: { id: "dashboard_slider" } });
      if (sliderSetting?.data) {
        try {
          const slider = normalizeDashboardSliderSettings(JSON.parse(sliderSetting.data));
          sliderMeta = deriveDashboardSliderMeta(slider);
          try {
            await saveDashboardSliderMeta(sliderMeta);
          } catch (err) {
            console.error("Failed to persist slider meta", err);
          }
        } catch {
          sliderMeta = DEFAULT_DASHBOARD_SLIDER_META;
        }
      }
    }

    sliderConfig = {
      enabled: sliderMeta.enabled,
      hasMedia: sliderMeta.hasMedia,
      height: sliderMeta.height,
      transitionMs: sliderMeta.transitionMs,
      style: sliderMeta.style,
      objectFit: sliderMeta.objectFit,
    };
  } catch (e) {
    console.error("Failed to load dashboard settings:", e);
  }

  return <DashboardClient visibility={visibility} sliderConfig={sliderConfig} showVideoSpotlight={showVideoSpotlight} />;
}
