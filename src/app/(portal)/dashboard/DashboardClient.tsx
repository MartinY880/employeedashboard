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
import { OooWidget } from "@/components/widgets/OooWidget";
import { FeedPanel } from "@/components/widgets/FeedPanel";
import { EmployeeHighlight } from "@/components/widgets/EmployeeHighlight";
import { VideoSpotlightWidget } from "@/components/widgets/VideoSpotlightWidget";
import { MyShareFeedWidget } from "@/components/widgets/MyShareFeedWidget";
import { ImportantDatesWidget } from "@/components/widgets/ImportantDatesWidget";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import {
  DashboardSlider,
  type DashboardSliderStyle,
  type DashboardSliderMedia,
  type DashboardSliderObjectFit,
} from "@/components/widgets/DashboardSlider";
import { ClosersTableBanner } from "@/components/widgets/ClosersTableBanner";
import { TimeZoneWidget } from "@/components/widgets/TimeZoneWidget";
import { FlyerWidget } from "@/components/widgets/FlyerWidget";
import { UnifiedReportsWidget } from "@/components/widgets/UnifiedReportsWidget";
import { CelebrationsBanner } from "@/components/widgets/CelebrationsBanner";
import { RebuttalOfTheDayWidget } from "@/components/widgets/RebuttalOfTheDayWidget";
import Link from "next/link";
import {
  Trophy,
  ArrowRight,
  Plane,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Lightbulb,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

export default function DashboardClient({
  visibility,
  sliderConfig,
  showVideoSpotlight,
}: DashboardClientProps) {
  // Only fetch slider media when the server tells us the slider is enabled + has media
  const [sliderMedia, setSliderMedia] = useState<DashboardSliderMedia[] | null>(
    null,
  );
  const [showOoo, setShowOoo] = useState(false);
  const [celebrationDate, setCelebrationDate] = useState<string>("");
  const [flyerHidden, setFlyerHidden] = useState(false);
  const [showMineOnly, setShowMineOnly] = useState(false);
  const sliderActive = sliderConfig.enabled && sliderConfig.hasMedia;

  // Ref for Be Brilliant column + measured height so the Props/Feed column
  // can match it exactly (Be Brilliant height is dynamic — varies with how
  // many ideas render). CSS grid can't target a single column's height, so
  // we measure and apply it. Only applies on lg+ (the 3-col layout).
  const brilliantRef = useRef<HTMLDivElement>(null);
  const [feedHeight, setFeedHeight] = useState<number | null>(null);
  const [celebrationsHeight, setCelebrationsHeight] = useState<number>(0);
  // Once the user clicks "View More" in MyShare, drop the height cap so the
  // card grows freely to show the rest of the posts (no scroll).
  const [myShareExpanded, setMyShareExpanded] = useState(false);
  const celebrationsRoRef = useRef<ResizeObserver | null>(null);
  const celebrationsRef = useCallback((el: HTMLDivElement | null) => {
    if (celebrationsRoRef.current) {
      celebrationsRoRef.current.disconnect();
      celebrationsRoRef.current = null;
    }
    if (!el) { setCelebrationsHeight(0); return; }
    setCelebrationsHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setCelebrationsHeight(el.offsetHeight));
    ro.observe(el);
    celebrationsRoRef.current = ro;
  }, []);

  useEffect(() => {
    const el = brilliantRef.current;
    if (!el) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      setFeedHeight(mql.matches ? el.offsetHeight : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    mql.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      mql.removeEventListener("change", measure);
    };
  }, []);


  useEffect(() => {
    if (!sliderActive) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/dashboard-settings", {
          cache: "no-store",
        });
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
    return () => {
      mounted = false;
    };
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
                    Follow matchups, check winners, and jump into the full
                    bracket now.
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
      {/* Important Dates + Quick Links — side by side */}
      <section className="mb-5 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {visibility.showImportantDates && (
          <ErrorBoundary label="Important Dates" compact>
            <ImportantDatesWidget />
          </ErrorBoundary>
        )}
        <ErrorBoundary label="Quick Links" compact>
          <QuickLinksBar />
        </ErrorBoundary>
      </section>
      {/* Directory Search + Alerts Bar */}
      <section
        className={`mb-5 grid grid-cols-1 ${visibility.showLenderAccountExecutives ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}
      >
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
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex-1 text-left">
              Out of Office
            </span>
          </button>
        </ErrorBoundary>
      </section>

      {/* OOO Lightbox */}
      {showOoo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowOoo(false)}
        >
          <div
            className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-brand-blue" />
                <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
                  Out of Office
                </h3>
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

      {/* Rebuttal of the Day */}
      <section className="mb-5 mt-5">
        <ErrorBoundary label="Rebuttal of the Day" compact>
          <RebuttalOfTheDayWidget />
        </ErrorBoundary>
      </section>

      {/* Spotlight + Employee Highlight + Upcoming Dates + Timezone (4-col) */}
      <section className="mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_1fr] gap-4 auto-rows-auto lg:auto-rows-[minmax(0,450px)]">
          {/* Spotlight Video — col 1 */}
          {showVideoSpotlight && (
            <div className="lg:col-start-1 lg:h-full overflow-hidden">
              <ErrorBoundary label="ProConnect Message" compact>
                <VideoSpotlightWidget />
              </ErrorBoundary>
            </div>
          )}

          {/* Col 2: Flyers full height — hidden when no active flyers */}
          {!flyerHidden && (
            <div className="lg:col-start-2 lg:h-full">
              <ErrorBoundary label="Events" compact>
                <FlyerWidget onEmpty={() => setFlyerHidden(true)} />
              </ErrorBoundary>
            </div>
          )}

          {/* Col 3: Employee Highlight + Weather stacked
              Expands to span cols 2–3 when there are no active flyers */}
          <div
            className={`lg:h-full flex flex-col gap-4 ${flyerHidden ? "lg:col-start-2 lg:col-span-2" : "lg:col-start-3"}`}
          >
            <div className="lg:flex-1 min-h-0">
              <ErrorBoundary label="Employee Highlight" compact>
                <EmployeeHighlight />
              </ErrorBoundary>
            </div>
            <div className="lg:flex-1 min-h-0">
              <ErrorBoundary label="Weather Forecast" compact>
                <WeatherForecastWidget />
              </ErrorBoundary>
            </div>
          </div>

          {/* Time Zones — col 4 */}
          <div className="lg:col-start-4 lg:h-full overflow-hidden">
            <ErrorBoundary label="Time Zones" compact>
              <TimeZoneWidget />
            </ErrorBoundary>
          </div>
        </div>
      </section>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1.3fr_0.7fr] gap-5 items-start">
        {/* Left: Feed — capped to Be Brilliant's height (scrolls when long),
            shrinks to content when short (see feedHeight) */}
        <div
          className="flex flex-col min-h-0"
          style={feedHeight ? { maxHeight: feedHeight } : undefined}
        >
          <ErrorBoundary label="Feed">
            <FeedPanel />
          </ErrorBoundary>
        </div>

        {/* Center: Be Brilliant */}
        <div ref={brilliantRef} className="min-w-0 space-y-5">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
                    Be Brilliant
                  </h3>
                  <p className="text-[11px] text-brand-grey mt-0.5">
                    Vote on ideas &amp; share yours
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMineOnly((v) => !v)}
                  className="shrink-0 flex items-center gap-2 px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-brand-blue/40 transition-all"
                  title={
                    showMineOnly
                      ? "Showing your ideas only"
                      : "Show my ideas only"
                  }
                >
                  <span
                    className={`text-xs font-semibold transition-colors ${
                      showMineOnly
                        ? "text-brand-blue"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    My Ideas
                  </span>
                  <div
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      showMineOnly
                        ? "bg-brand-blue"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <div
                      className={`absolute top-[3px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-[left] duration-200 ${
                        showMineOnly ? "left-[17px]" : "left-[3px]"
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>
            <ErrorBoundary label="Be Brilliant" compact>
              <BeBrilliantWidget showMineOnly={showMineOnly} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Right: Celebrations + MyShare Feed — capped to Be Brilliant's height
            so the column never exceeds it (MyShare auto-fits within whatever
            space remains below Celebrations). View More overrides this on the
            widget level since MyShare has no scroll. */}
        <div
          className="min-w-0 flex flex-col gap-5"
        >
          {/* Celebrations */}
          {visibility.showCelebrations !== false && (
            <div ref={celebrationsRef} className="shrink-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Celebrations
                    </h3>
                    <p className="text-[11px] text-brand-grey mt-0.5">
                      Birthdays, anniversaries &amp; milestones
                    </p>
                  </div>
                  {/* Inline date navigation */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const todayStr = new Date().toLocaleDateString(
                          "en-CA",
                          { timeZone: "America/New_York" },
                        );
                        const base = celebrationDate || todayStr;
                        const d = new Date(base + "T12:00:00");
                        d.setDate(d.getDate() - 1);
                        setCelebrationDate(
                          d.toLocaleDateString("en-CA", {
                            timeZone: "America/New_York",
                          }),
                        );
                      }}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-blue transition-colors"
                      aria-label="Previous day"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                        >
                          {(() => {
                            const todayStr = new Date().toLocaleDateString(
                              "en-CA",
                              { timeZone: "America/New_York" },
                            );
                            const isToday =
                              !celebrationDate || celebrationDate === todayStr;
                            const label = isToday
                              ? "Today"
                              : new Date(
                                  celebrationDate + "T12:00:00",
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                });
                            return (
                              <span className="text-[11px] font-semibold text-brand-blue underline decoration-dotted underline-offset-2 select-none">
                                {label}
                              </span>
                            );
                          })()}
                          <CalendarDays className="h-3 w-3 text-brand-blue" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center">
                        <Calendar
                          mode="single"
                          selected={(() => {
                            const todayStr = new Date().toLocaleDateString(
                              "en-CA",
                              { timeZone: "America/New_York" },
                            );
                            const d = celebrationDate || todayStr;
                            return new Date(d + "T12:00:00");
                          })()}
                          onSelect={(day) => {
                            if (day) {
                              const todayStr = new Date().toLocaleDateString(
                                "en-CA",
                                { timeZone: "America/New_York" },
                              );
                              const selected = day.toLocaleDateString("en-CA", {
                                timeZone: "America/New_York",
                              });
                              setCelebrationDate(
                                selected === todayStr ? "" : selected,
                              );
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <button
                      type="button"
                      onClick={() => {
                        const todayStr = new Date().toLocaleDateString(
                          "en-CA",
                          { timeZone: "America/New_York" },
                        );
                        const base = celebrationDate || todayStr;
                        const d = new Date(base + "T12:00:00");
                        d.setDate(d.getDate() + 1);
                        const next = d.toLocaleDateString("en-CA", {
                          timeZone: "America/New_York",
                        });
                        setCelebrationDate(next === todayStr ? "" : next);
                      }}
                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-blue transition-colors"
                      aria-label="Next day"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <ErrorBoundary label="Celebrations" compact>
                <CelebrationsBanner
                  selectedDate={celebrationDate || undefined}
                  onDateChange={setCelebrationDate}
                />
              </ErrorBoundary>
            </div>
          )}

          {/* MyShare — grows to fill the space below Celebrations so the column
              reaches Be Brilliant's bottom edge. No scroll: if content is taller
              (e.g. View More), it simply extends past Be Brilliant. */}
          {visibility.showMyShare !== false && (
            <div
              data-myshare-container
              className={`relative flex flex-col flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${myShareExpanded ? "" : "overflow-hidden"}`}
              style={
                !myShareExpanded && feedHeight && celebrationsHeight
                  ? { maxHeight: feedHeight - celebrationsHeight - 20 }
                  : undefined
              }
            >
              <div className="shrink-0 px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue">
                <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase flex items-center gap-1.5">
                  MyShare
                </h3>
                <p className="text-[11px] text-brand-grey mt-0.5">
                  Share moments &amp; celebrate wins
                </p>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <ErrorBoundary label="MyShare" compact>
                  <MyShareFeedWidget onExpand={() => setMyShareExpanded(true)} />
                </ErrorBoundary>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
