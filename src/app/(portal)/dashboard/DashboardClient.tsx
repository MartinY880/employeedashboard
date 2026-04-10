// ProConnect — Dashboard Client Component
// Visibility flags and slider config arrive as server-side props (instant).
// Slider media (base64 blobs) are fetched client-side only when the slider is enabled.

"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { QuickLinksBar } from "@/components/widgets/QuickLinksBar";
import { WeatherForecastWidget } from "@/components/widgets/WeatherForecastWidget";
import { DirectorySearchBar } from "@/components/widgets/DirectorySearchBar";
import { LenderAccountExecutivesDropdown } from "@/components/widgets/LenderAccountExecutivesDropdown";
import { AlertsDropdown } from "@/components/widgets/AlertsDropdown";
import { BeBrilliantWidget } from "@/components/widgets/BeBrilliantWidget";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { OooWidget } from "@/components/widgets/OooWidget";
import { FeedPanel } from "@/components/widgets/FeedPanel";
import { EmployeeHighlight } from "@/components/widgets/EmployeeHighlight";
import { VideoSpotlightWidget } from "@/components/widgets/VideoSpotlightWidget";
import { MyShareFeedWidget } from "@/components/widgets/MyShareFeedWidget";
import { ImportantDatesWidget } from "@/components/widgets/ImportantDatesWidget";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { DashboardSlider, type DashboardSliderStyle, type DashboardSliderMedia, type DashboardSliderObjectFit } from "@/components/widgets/DashboardSlider";
import { ClosersTableBanner } from "@/components/widgets/ClosersTableBanner";
import { UnifiedReportsWidget } from "@/components/widgets/UnifiedReportsWidget";
import { CelebrationsBanner } from "@/components/widgets/CelebrationsBanner";
import Link from "next/link";
import { Trophy, ArrowRight, Plane, X, Sparkles, Calendar } from "lucide-react";

interface DashboardVisibilitySettings {
  showTournamentBracketLive: boolean;
  showImportantDates: boolean;
  showLenderAccountExecutives: boolean;
  showCelebrations: boolean;
  showMyShare: boolean;
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
  showVideoSpotlight?: boolean;
}

export default function DashboardClient({ visibility, sliderConfig, showVideoSpotlight }: DashboardClientProps) {
  // Only fetch slider media when the server tells us the slider is enabled + has media
  const [sliderMedia, setSliderMedia] = useState<DashboardSliderMedia[] | null>(null);
  const [showOoo, setShowOoo] = useState(false);
  const [celebrationDate, setCelebrationDate] = useState<string>("");
  const sliderActive = sliderConfig.enabled && sliderConfig.hasMedia;

  // Ref for Be Brilliant column
  const brilliantRef = useRef<HTMLDivElement>(null);

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
                style={{
                  aspectRatio: `1920 / ${Math.max(120, sliderConfig.height)}`,
                  maxHeight: `${Math.max(120, sliderConfig.height)}px`,
                  minHeight: "160px",
                }}
              />
            )}
          </ErrorBoundary>
        </section>
      ) : null}

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

      {/* Important Dates — full-width row */}
      {visibility.showImportantDates && (
        <section className="mb-5">
          <ErrorBoundary label="Important Dates" compact>
            <ImportantDatesWidget />
          </ErrorBoundary>
        </section>
      )}

      {/* Directory Search + Alerts Bar */}
      <section className={`mb-5 grid grid-cols-1 ${visibility.showLenderAccountExecutives ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
        <ErrorBoundary label="Directory Search" compact>
          <DirectorySearchBar />
        </ErrorBoundary>
        {visibility.showLenderAccountExecutives ? (
          <ErrorBoundary label="Account Executive Contacts" compact>
            <div className="h-full [&>button]:h-full">
              <LenderAccountExecutivesDropdown />
            </div>
          </ErrorBoundary>
        ) : null}
        <ErrorBoundary label="Alerts" compact>
          <AlertsDropdown />
        </ErrorBoundary>
        <ErrorBoundary label="Out of Office" compact>
          <button
            type="button"
            onClick={() => setShowOoo(true)}
            className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-3 py-2 gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Plane className="w-4 h-4 text-brand-grey/60 shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex-1 text-left">Out of Office</span>
          </button>
        </ErrorBoundary>
      </section>

      {/* OOO Lightbox */}
      {showOoo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowOoo(false)}>
          <div
            className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-brand-blue" />
                <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">Out of Office</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOoo(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              <ErrorBoundary label="Out of Office" compact>
                <OooWidget />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      )}

      {/* Unified Reports Widget (Company + Individual Pipeline) */}
      <section className="mb-5">
        <ErrorBoundary label="Reports" compact>
          <UnifiedReportsWidget />
        </ErrorBoundary>
      </section>

      {/* Closers Table Awards Banner */}
      <ErrorBoundary label="Closers Table" compact>
        <ClosersTableBanner />
      </ErrorBoundary>

      {/* Quick Links + Weather + Upcoming Important Dates */}
      <section className="mb-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ErrorBoundary label="Quick Links" compact>
            <QuickLinksBar />
          </ErrorBoundary>
          <ErrorBoundary label="Weather Forecast" compact>
            <WeatherForecastWidget />
          </ErrorBoundary>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden h-full">
            <div className="px-3.5 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
                Upcoming Dates
              </h3>
              <p className="text-[10px] text-brand-grey">Company calendar</p>
            </div>
            <ErrorBoundary label="Calendar" compact>
              <CalendarWidget />
            </ErrorBoundary>
          </div>
        </div>
      </section>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1.3fr_0.7fr] gap-5 items-start">
        {/* Left: ProConnect Message + Employee Highlight + Props + Upcoming Dates */}
        <div className="space-y-5">
          {showVideoSpotlight && (
            <ErrorBoundary label="ProConnect Message" compact>
              <VideoSpotlightWidget />
            </ErrorBoundary>
          )}

          <ErrorBoundary label="Employee Highlight" compact>
            <EmployeeHighlight />
          </ErrorBoundary>

          <ErrorBoundary label="Feed">
            <FeedPanel />
          </ErrorBoundary>
        </div>

        {/* Center: Be Brilliant */}
        <div ref={brilliantRef} className="min-w-0 space-y-5">
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

        {/* Right: Celebrations + MyShare Feed */}
        <div className="min-w-0 space-y-5">
          {/* Celebrations */}
          {visibility.showCelebrations !== false && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Celebrations
                    </h3>
                    <p className="text-[11px] text-brand-grey mt-0.5">
                      {celebrationDate ? new Date(celebrationDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Birthdays, anniversaries & milestones"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {celebrationDate && (
                      <button
                        type="button"
                        onClick={() => setCelebrationDate("")}
                        className="text-[10px] font-medium text-brand-blue hover:underline"
                      >
                        Today
                      </button>
                    )}
                    <label className="relative cursor-pointer p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-blue transition-colors">
                      <Calendar className="h-4 w-4" />
                      <input
                        type="date"
                        value={celebrationDate}
                        onChange={(e) => setCelebrationDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <ErrorBoundary label="Celebrations" compact>
                <CelebrationsBanner selectedDate={celebrationDate || undefined} onDateChange={setCelebrationDate} />
              </ErrorBoundary>
            </div>
          )}

          {/* MyShare */}
          {visibility.showMyShare !== false && (
          <div
            data-myshare-container
            className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
              <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
                MyShare
              </h3>
              <p className="text-[11px] text-brand-grey mt-0.5">Share moments &amp; celebrate wins</p>
            </div>
            <ErrorBoundary label="MyShare" compact>
              <MyShareFeedWidget />
            </ErrorBoundary>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
