// ProConnect — Holiday Detail Dialog
// Shared detail dialog used by both CalendarWidget and ImportantDatesWidget.
// Presentational: callers resolve the title, date label, and category color/label
// (each widget has its own category systems) and pass them in.

"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalendarHoliday } from "@/hooks/useCalendar";
import { AnimatePresence, motion } from "framer-motion";

interface HolidayDetailDialogProps {
  holiday: CalendarHoliday | null;
  onClose: () => void;
  /** Dialog heading, e.g. "Holiday Details" or "Important Date". */
  title: string;
  /** Pre-formatted date string (callers format with their own convention). */
  dateLabel: string;
  /** Resolved hex color for the category badge. */
  categoryColor: string;
  /** Resolved human-readable category label. */
  categoryLabel: string;
}

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

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}

export function HolidayDetailDialog({
  holiday,
  onClose,
  title,
  dateLabel,
  categoryColor,
  categoryLabel,
}: HolidayDetailDialogProps) {
  const hasRichContent = holiday?.event?.htmlContent || holiday?.event?.flyer;
  const lbw = holiday?.event?.lightboxWidth || 90;

  const [pdfLoaded, setPdfLoaded] = useState(false);
  useEffect(() => {
    setPdfLoaded(false);
  }, [holiday?.event?.flyer?.fileUrl]);

  return (
    <Dialog open={!!holiday} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
       className={hasRichContent ? "h-[90vh] overflow-hidden lightbox-rich" : "sm:max-w-md"}
        style={
          hasRichContent
            ? ({ "--lb-width": `${lbw}vw` } as React.CSSProperties)
            : undefined
        }
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
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>
        {holiday && (
          <div className="space-y-3 text-sm h-full flex flex-col">
            <div>
              <div className="text-xs text-brand-grey">Title</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100 break-words">
                {holiday.title}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-brand-grey flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Date
                </div>
                <div className="text-gray-800 dark:text-gray-200">
                  {dateLabel}
                </div>
                {holiday.event?.startTime && (
                  <div className="text-xs text-brand-grey mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(holiday.event.startTime)}
                    {holiday.event.endTime &&
                      ` – ${formatTime(holiday.event.endTime)}`}
                  </div>
                )}
              </div>
              <div>
                <div className="text-xs text-brand-grey">Category</div>
                <Badge
                  variant="secondary"
                  className="mt-1 text-[10px] px-2 py-0.5 font-medium"
                  style={getBadgeStyle(categoryColor)}
                >
                  {categoryLabel}
                </Badge>
              </div>
            </div>
            {(holiday.event?.location || holiday.event?.description) &&
              (() => {
                const loc = holiday.event?.location;
                const desc = holiday.event?.description;
                const shortDesc = desc && desc.length <= 60;
                return (
                  <>
                    {loc && desc && shortDesc ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-brand-grey flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Location
                          </div>
                          <div className="text-gray-800 dark:text-gray-200">
                            {loc}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-brand-grey">Details</div>
                          <div className="text-gray-700 dark:text-gray-300">
                            {desc}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {loc && (
                          <div>
                            <div className="text-xs text-brand-grey flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Location
                            </div>
                            <div className="text-gray-800 dark:text-gray-200">
                              {loc}
                            </div>
                          </div>
                        )}
                        {desc && (
                          <div>
                            <div className="text-xs text-brand-grey">
                              Details
                            </div>
                            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {desc}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}

            {holiday.event?.htmlContent && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex-1 min-h-0">
                <iframe
                  srcDoc={`<style>*{box-sizing:border-box;max-width:100%}body{margin:0;padding:12px;overflow-x:hidden;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;background:#fff}img{height:auto;display:block}a{color:#2563eb;text-decoration:underline}table{border-collapse:collapse;width:100%}td,th{padding:4px 8px}</style>${holiday.event.htmlContent}`}
                  sandbox="allow-scripts allow-same-origin"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                  style={{ minHeight: 120, maxHeight: "60vh", width: "100%" }}
                  title={`${holiday.title} display`}
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
            {holiday.event?.flyer &&
              (() => {
                const flyer = holiday.event.flyer;
                const isImage = flyer.mimeType.startsWith("image/");
                const isPdf = flyer.mimeType === "application/pdf";
                return (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <div className="text-xs text-brand-grey mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Flyer
                    </div>
                    <AnimatePresence mode="wait">
                      {isPdf ? (
                        <div className="relative w-full h-full" style={{ minHeight: "500px" }}>
                          <motion.iframe
                            key={flyer.fileUrl}
                            src={`${flyer.fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                            title={flyer.fileName}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="w-full h-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white"
                            onLoad={() => setPdfLoaded(true)}
                          />
                          <AnimatePresence>
                            {!pdfLoaded && flyer.thumbnailUrl && (
                              <motion.img
                                key="thumb"
                                src={flyer.thumbnailUrl}
                                alt=""
                                aria-hidden
                                initial={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="absolute inset-0 w-full h-full object-contain rounded-xl bg-white pointer-events-none"
                              />
                            )}
                          </AnimatePresence>
                        </div>
                      ) : isImage ? (
                        <motion.img
                          key={flyer.fileUrl}
                          src={flyer.fileUrl}
                          alt={flyer.fileName}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
                          draggable={false}
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
                    </AnimatePresence>
                  </div>
                );
              })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
