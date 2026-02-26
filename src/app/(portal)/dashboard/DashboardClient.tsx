// ProConnect — Dashboard Client Component
// Visibility flags and slider config arrive as server-side props (instant).
// Slider media (base64 blobs) are fetched client-side only when the slider is enabled.

"use client";

import { useEffect, useState } from "react";
import { StatsRow } from "@/components/widgets/StatsRow";
import { QuickLinksBar } from "@/components/widgets/QuickLinksBar";
import { DirectorySearchBar } from "@/components/widgets/DirectorySearchBar";
import { AlertsDropdown } from "@/components/widgets/AlertsDropdown";
import { BeBrilliantWidget } from "@/components/widgets/BeBrilliantWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { OooWidget } from "@/components/widgets/OooWidget";
import { FeedPanel } from "@/components/widgets/FeedPanel";
import { EmployeeHighlight } from "@/components/widgets/EmployeeHighlight";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DashboardSlider, type DashboardSliderStyle, type DashboardSliderMedia, type DashboardSliderObjectFit } from "@/components/widgets/DashboardSlider";
import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";

interface DashboardVisibilitySettings {
  showCompanyPillars: boolean;
  showTournamentBracketLive: boolean;
}

interface SliderConfig {
  enabled: boolean;
  hasMedia: boolean;
  height: number;
  transitionMs: number;
  style: DashboardSliderStyle;
  objectFit: DashboardSliderObjectFit;
}

interface DashboardClientProps {
  visibility: DashboardVisibilitySettings;
  sliderConfig: SliderConfig;
}

export default function DashboardClient({ visibility, sliderConfig }: DashboardClientProps) {
  // Only fetch slider media when the server tells us the slider is enabled + has media
  const [sliderMedia, setSliderMedia] = useState<DashboardSliderMedia[] | null>(null);
  const sliderActive = sliderConfig.enabled && sliderConfig.hasMedia;

  useEffect(() => {
    if (!sliderActive) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/dashboard-settings", { cache: "no-store" });
        if (!res.ok) throw new Error("slider fetch failed");
        const data = await res.json();
        if (!mounted) return;
        const media: DashboardSliderMedia[] = Array.isArray(data?.slider?.media)
          ? data.slider.media.filter((m: DashboardSliderMedia) => m?.src)
          : [];
        setSliderMedia(media);
      } catch {
        if (mounted) setSliderMedia([]);
      }
    })();
    return () => { mounted = false; };
  }, [sliderActive]);

  return (
    <div className="max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-14 py-4 sm:py-6">
      {/* Dashboard Slider — top of page, above pillars.
          Space is reserved immediately (no layout shift); media loads client-side. */}
      {sliderActive ? (
        <section className="mb-5">
          <ErrorBoundary label="Dashboard Slider" compact>
            {sliderMedia && sliderMedia.length > 0 ? (
              <DashboardSlider
                media={sliderMedia}
                height={sliderConfig.height}
                transitionMs={sliderConfig.transitionMs}
                style={sliderConfig.style}
                objectFit={sliderConfig.objectFit}
              />
            ) : (
              <div
                className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-gray-50 dark:bg-gray-800 animate-pulse"
                style={{ height: `${Math.max(120, sliderConfig.height)}px` }}
              />
            )}
          </ErrorBoundary>
        </section>
      ) : null}

      {/* Stats Row / Company Pillars */}
      {visibility.showCompanyPillars ? (
        <section className="mb-6">
          <ErrorBoundary label="Stats" compact>
            <StatsRow />
          </ErrorBoundary>
        </section>
      ) : null}

      {/* Quick Links */}
      <section className="mb-4">
        <ErrorBoundary label="Quick Links" compact>
          <QuickLinksBar />
        </ErrorBoundary>
      </section>

      {/* Tournament Banner */}
      {visibility.showTournamentBracketLive ? (
        <section className="mb-5">
          <Link
            href="/tournament"
            className="group block rounded-xl border border-brand-blue/20 bg-gradient-to-r from-brand-blue to-blue-700 p-5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01]"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white">
                  <Trophy className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-wide uppercase">
                    Tournament Bracket Live
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-100 truncate">
                    Follow matchups, check winners, and jump into the full bracket now.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-white text-sm font-semibold whitespace-nowrap">
                View Bracket
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          </Link>
        </section>
      ) : null}

      {/* Directory Search + Alerts Bar */}
      <section className="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ErrorBoundary label="Directory Search" compact>
          <DirectorySearchBar />
        </ErrorBoundary>
        <ErrorBoundary label="Alerts" compact>
          <AlertsDropdown />
        </ErrorBoundary>
      </section>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_380px] gap-5 items-start">
        {/* Left: OOO + Upcoming Holidays */}
        <div className="space-y-5">
          {/* OOO Widget */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
                Out of Office
              </h3>
              <p className="text-[11px] text-brand-grey mt-0.5">Auto-reply & scheduling</p>
            </div>
            <ErrorBoundary label="Out of Office" compact>
              <OooWidget />
            </ErrorBoundary>
          </div>

          {/* Upcoming Holidays */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
                Upcoming Holidays
              </h3>
              <p className="text-[11px] text-brand-grey mt-0.5">Company calendar</p>
            </div>
            <ErrorBoundary label="Calendar" compact>
              <CalendarWidget />
            </ErrorBoundary>
          </div>
        </div>

        {/* Center: Be Brilliant */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
                Be Brilliant
              </h3>
              <p className="text-[11px] text-brand-grey mt-0.5">Vote on ideas &amp; share yours</p>
            </div>
            <ErrorBoundary label="Be Brilliant" compact>
              <BeBrilliantWidget />
            </ErrorBoundary>
          </div>
        </div>

        {/* Right: Employee Highlight + Props & Trophies */}
        <div className="space-y-4">
          <ErrorBoundary label="Employee Highlight" compact>
            <EmployeeHighlight />
          </ErrorBoundary>
          <ErrorBoundary label="Feed">
            <FeedPanel />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
