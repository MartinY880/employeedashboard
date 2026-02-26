// ProConnect — CalendarWidget
// Upcoming holidays from the Calendar app proxy (center column)

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ExternalLink, RefreshCw } from "lucide-react";
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

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function CalendarWidget() {
  const { holidays, isLoading, isEmpty, refetch } = useCalendar(6);
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
      <div className="p-4 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-1.5 h-8 rounded-full" />
            <Skeleton className="w-4 h-4 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AnimatePresence mode="popLayout">
        {holidays.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 py-8 text-center"
          >
            <Calendar className="w-8 h-8 text-brand-grey/40 mx-auto mb-2" />
            <p className="text-sm text-brand-grey">No upcoming holidays</p>
          </motion.div>
        ) : (
          holidays.map((holiday, i) => {
            const days = daysUntil(holiday.date);
            const isToday = days === 0;
            const isSoon = days > 0 && days <= 7;

            return (
              <motion.button
                key={holiday.id}
                type="button"
                onClick={() => setSelectedHoliday(holiday)}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group ${
                  isToday ? "bg-brand-blue/5" : ""
                }`}
              >
                <div
                  className="w-1.5 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: getCategoryColor(holiday.category) }}
                />
                <Calendar className="w-4 h-4 text-brand-grey shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {holiday.title}
                  </div>
                  <div className="text-xs text-brand-grey">
                    {formatDate(holiday.date)}
                    {isToday && (
                      <span className="ml-1.5 text-brand-blue font-semibold">
                        Today!
                      </span>
                    )}
                    {isSoon && !isToday && (
                      <span className="ml-1.5 text-amber-600 font-medium">
                        in {days} day{days !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5 font-medium"
                  style={getBadgeStyle(getCategoryColor(holiday.category))}
                >
                  {getCategoryLabel(holiday.category)}
                </Badge>
              </motion.button>
            );
          })
        )}
      </AnimatePresence>

      <div className="px-4 pt-2 pb-3 flex items-center justify-between">
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Holiday Details</DialogTitle>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-brand-grey">Title</div>
                <div className="font-semibold text-gray-900 dark:text-gray-100 break-words">{selectedHoliday.title}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-brand-grey">Date</div>
                  <div className="text-gray-800 dark:text-gray-200">{formatDate(selectedHoliday.date)}</div>
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
