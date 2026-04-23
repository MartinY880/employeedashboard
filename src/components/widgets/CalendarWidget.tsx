// ProConnect — CalendarWidget
// Upcoming holidays from the Calendar app proxy (center column)

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ExternalLink, RefreshCw, Clock, MapPin, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCalendar, type CalendarHoliday } from "@/hooks/useCalendar";

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  federal: "#1e40af",
  company: "#06427F",
  fun: "#16a34a",
  observance: "#9333ea",
};

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  federal: "Federal",
  company: "Company",
  fun: "Fun",
  observance: "Observance",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return {
    r: parseInt(cleaned.slice(0, 2), 16),
    g: parseInt(cleaned.slice(2, 4), 16),
    b: parseInt(cleaned.slice(4, 6), 16),
  };
}

function getBadgeStyle(color: string) {
  const rgb = hexToRgb(color);
  if (!rgb) return { backgroundColor: "#f3f4f6", color: "#374151" };
  return {
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    color,
  };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function CalendarWidget() {
  const { holidays: allHolidays, isLoading, isEmpty, refetch } = useCalendar(6);
  const holidays = allHolidays.slice(0, 6);
  const [selectedHoliday, setSelectedHoliday] = useState<CalendarHoliday | null>(null);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(DEFAULT_CATEGORY_COLORS);
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(DEFAULT_CATEGORY_LABELS);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/calendar/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.category_colors) {
          setCategoryColors((prev) => ({ ...prev, ...data.category_colors }));
        }
        if (data.category_labels) {
          setCategoryLabels((prev) => ({ ...prev, ...data.category_labels }));
        }
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  const getCategoryColor = (category: string) => categoryColors[category] || DEFAULT_CATEGORY_COLORS[category] || "#6b7280";
  const getCategoryLabel = (category: string) => categoryLabels[category] || DEFAULT_CATEGORY_LABELS[category] || category;

  if (isLoading) {
    return (
      <div className="p-3 grid grid-cols-2 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
            <Skeleton className="w-8 h-8 rounded-md shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {holidays.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <Calendar className="w-5 h-5 text-brand-grey/40 mx-auto mb-1" />
            <p className="text-xs text-brand-grey">No upcoming holidays</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-2 grid grid-cols-2 gap-1.5 auto-rows-min">
          {holidays.map((holiday, i) => {
            const days = daysUntil(holiday.date);
            const isToday = days === 0;
            const isSoon = days > 0 && days <= 7;
            const catColor = getCategoryColor(holiday.category);

            return (
              <motion.button
                key={holiday.id}
                type="button"
                onClick={() => setSelectedHoliday(holiday)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.04 }}
                className={`text-left flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  isToday ? "bg-brand-blue/5 border-brand-blue/20" : "bg-white dark:bg-gray-900"
                }`}
              >
                <div
                  className="w-1 h-6 rounded-full shrink-0"
                  style={{ backgroundColor: catColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-gray-800 dark:text-gray-200 truncate leading-tight">
                    {holiday.title}
                  </div>
                  <div className="text-[9px] text-brand-grey leading-tight mt-0.5">
                    {formatDate(holiday.date)}
                    {isToday && <span className="ml-1 text-brand-blue font-semibold">Today!</span>}
                    {isSoon && !isToday && <span className="ml-1 text-amber-600 font-medium">{days}d</span>}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <div className="shrink-0 px-2 py-1.5 flex items-center justify-between border-t border-gray-100 dark:border-gray-800">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:underline font-medium"
        >
          View full calendar <ExternalLink className="w-3 h-3" />
        </Link>
        <div className="flex items-center gap-2">
          {isEmpty && (
            <span className="text-[10px] text-brand-grey/60 italic">no data</span>
          )}
          <button
            onClick={() => refetch()}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3 text-brand-grey" />
          </button>
        </div>
      </div>

      <Dialog open={!!selectedHoliday} onOpenChange={(open) => !open && setSelectedHoliday(null)}>
        {(() => {
          const hasRichContent = selectedHoliday?.event?.htmlContent || selectedHoliday?.event?.flyer;
          const lbw = selectedHoliday?.event?.lightboxWidth || 90;
          return (
            <DialogContent
              className={hasRichContent ? "max-h-[90vh] overflow-y-auto lightbox-rich" : "sm:max-w-md"}
              style={hasRichContent ? { "--lb-width": `${lbw}vw` } as React.CSSProperties : undefined}
            >
              {hasRichContent && (
                <style>{`
                  .lightbox-rich { width: calc(100vw - 2rem) !important; max-width: calc(100vw - 2rem) !important; }
                  @media (min-width: 768px) { .lightbox-rich { width: var(--lb-width) !important; max-width: var(--lb-width) !important; } }
                `}</style>
              )}
          <DialogHeader>
            <div className="flex items-start justify-between gap-3 pr-6">
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                Holiday Details
              </DialogTitle>
            </div>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-brand-grey">Title</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100 break-words">{selectedHoliday.title}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-brand-grey flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</div>
                  <div className="text-gray-800 dark:text-gray-200">{formatDate(selectedHoliday.date)}</div>
                  {selectedHoliday.event?.startTime && (
                    <div className="text-xs text-brand-grey mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(selectedHoliday.event.startTime)}
                      {selectedHoliday.event.endTime && ` – ${formatTime(selectedHoliday.event.endTime)}`}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-brand-grey">Category</div>
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[10px] px-2 py-0.5 font-medium"
                    style={getBadgeStyle(getCategoryColor(selectedHoliday.category))}
                  >
                    {getCategoryLabel(selectedHoliday.category)}
                  </Badge>
                </div>
              </div>
              {(selectedHoliday.event?.location || selectedHoliday.event?.description) && (() => {
                const loc = selectedHoliday.event?.location;
                const desc = selectedHoliday.event?.description;
                const shortDesc = desc && desc.length <= 60;
                return (
                  <>
                    {loc && desc && shortDesc ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-brand-grey flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</div>
                          <div className="text-gray-800 dark:text-gray-200">{loc}</div>
                        </div>
                        <div>
                          <div className="text-xs text-brand-grey">Details</div>
                          <div className="text-gray-700 dark:text-gray-300">{desc}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {loc && (
                          <div>
                            <div className="text-xs text-brand-grey flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</div>
                            <div className="text-gray-800 dark:text-gray-200">{loc}</div>
                          </div>
                        )}
                        {desc && (
                          <div>
                            <div className="text-xs text-brand-grey">Details</div>
                            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{desc}</div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
              {selectedHoliday.event?.htmlContent && (
                <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                  <iframe
                    srcDoc={`<style>*{box-sizing:border-box;max-width:100%}body{margin:0;overflow-x:hidden}</style>${selectedHoliday.event.htmlContent}`}
                    sandbox="allow-scripts allow-same-origin"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                    style={{ minHeight: 120, maxHeight: "60vh", width: "100%" }}
                    title={`${selectedHoliday.title} display`}
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      const doc = iframe.contentDocument;
                      if (!doc?.body) return;
                      const meta = doc.createElement("meta");
                      meta.name = "viewport";
                      meta.content = "width=device-width, initial-scale=1";
                      doc.head.appendChild(meta);
                      const maxH = window.innerHeight * 0.6;
                      const resize = () => {
                        const h = doc.body.scrollHeight + 16;
                        iframe.style.height = Math.min(h, maxH) + "px";
                      };
                      resize();
                      const ro = new ResizeObserver(resize);
                      ro.observe(doc.body);
                    }}
                  />
                </div>
              )}
              {selectedHoliday.event?.flyer && (() => {
                const flyer = selectedHoliday.event.flyer;
                const isImage = flyer.mimeType.startsWith("image/");
                const isPdf = flyer.mimeType === "application/pdf";
                return (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <div className="text-xs text-brand-grey mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Flyer
                    </div>
                    {isImage ? (
                      <img
                        src={flyer.fileUrl}
                        alt={flyer.fileName}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
                      />
                    ) : isPdf ? (
                      <iframe
                        src={flyer.fileUrl}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
                        style={{ height: "60vh" }}
                        title={flyer.fileName}
                      />
                    ) : (
                      <a
                        href={flyer.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-brand-blue hover:underline"
                      >
                        <FileText className="w-4 h-4" />
                        {flyer.fileName}
                      </a>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
