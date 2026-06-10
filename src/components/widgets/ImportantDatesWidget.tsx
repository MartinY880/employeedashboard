// ProConnect — Important Dates Widget
// Fetches important dates from /api/important-dates with client-side date resolution,
// then fills remaining slots with upcoming calendar events. Unified UI, 3 rows of 2.

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Calendar, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCalendar, type CalendarHoliday } from "@/hooks/useCalendar";
import { HolidayDetailDialog } from "@/components/widgets/HolidayDetailDialog";

const TOTAL_CAP = 6;

/* ── Date resolution helpers ── */

interface ImportantDateItem {
  id: string;
  label: string;
  subtitle: string | null;
  date: string;
  recurType: string;
  active: boolean;
}

interface UnifiedItem {
  id: string;
  title: string;
  subtitle: string | null;
  date: Date;
  dateStr: string;
  category: "important_dates" | string;
  color: string;
  calendarHoliday?: CalendarHoliday;
}

function easternToday(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return new Date(
    +parts.find((p) => p.type === "year")!.value,
    +parts.find((p) => p.type === "month")!.value - 1,
    +parts.find((p) => p.type === "day")!.value,
  );
}

function adjustToWorkday(d: Date): Date {
  const dow = d.getDay();
  if (dow === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
  if (dow === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return d;
}

function resolveDate(entry: ImportantDateItem): Date {
  const d = new Date(entry.date + "T00:00:00");
  const today = easternToday();

  if (entry.recurType === "first_workday") {
    let candidate = new Date(today.getFullYear(), today.getMonth(), 1);
    candidate = adjustToWorkday(candidate);
    if (candidate < today) {
      candidate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      candidate = adjustToWorkday(candidate);
    }
    return candidate;
  }

  if (entry.recurType === "monthly") {
    const day = d.getDate();
    let next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next < today) {
      next = new Date(today.getFullYear(), today.getMonth() + 1, day);
    }
    return next;
  }

  return d;
}

function daysUntil(d: Date): number {
  const today = easternToday();
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function daysLabel(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `${n}d`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORY_COLORS: Record<string, string> = {
  important_dates: "#dc2626",
  federal: "#1e40af",
  company: "#06427F",
  fun: "#16a34a",
  observance: "#9333ea",
};

const CATEGORY_LABELS: Record<string, string> = {
  important_dates: "Important Dates",
  federal: "Federal",
  company: "Company",
  fun: "Fun",
  observance: "Observance",
};

/* ══════════════════════════════════════════════════════════
   Widget
   ══════════════════════════════════════════════════════════ */

export function ImportantDatesWidget() {
  const [importantDates, setImportantDates] = useState<ImportantDateItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { holidays: calendarHolidays, isLoading: calLoading, refetch } = useCalendar(100);
  const [selectedHoliday, setSelectedHoliday] = useState<CalendarHoliday | null>(null);
  const [catColors, setCatColors] = useState<Record<string, string>>(CATEGORY_COLORS);

  useEffect(() => {
    fetch("/api/calendar/settings?key=category_colors")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCatColors((prev) => ({ ...prev, ...data }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/important-dates")
      .then((r) => r.json())
      .then((data) => setImportantDates(data.dates || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Resolve important dates with client-side recurrence logic.
  // Priority: current-month dates fill slots first; next-month dates only appear
  // once current-month dates are exhausted (i.e. there are fewer than TOTAL_CAP left).
  const etNow = easternToday();
  const curYear = etNow.getFullYear();
  const curMonth = etNow.getMonth();
  const nextMonth = curMonth === 11 ? 0 : curMonth + 1;
  const nextYear = curMonth === 11 ? curYear + 1 : curYear;

  const allResolved = importantDates
    .filter((d) => d.active !== false)
    .map((d) => ({ ...d, resolved: resolveDate(d) }))
    .filter((d) => d.resolved >= etNow)
    .sort((a, b) => a.resolved.getTime() - b.resolved.getTime());

  const currentMonthDates = allResolved.filter((d) => {
    return d.resolved.getFullYear() === curYear && d.resolved.getMonth() === curMonth;
  });

  const nextMonthDates = allResolved.filter((d) => {
    return d.resolved.getFullYear() === nextYear && d.resolved.getMonth() === nextMonth;
  });

  const slotsForNextMonth = currentMonthDates.length > 0 ? 0 : TOTAL_CAP;
  const selectedDates = [
    ...currentMonthDates,
    ...nextMonthDates.slice(0, slotsForNextMonth),
  ].slice(0, TOTAL_CAP);

  const resolvedImportant: UnifiedItem[] = selectedDates
    .map((d) => ({
      id: d.id,
      title: d.label,
      subtitle: d.subtitle,
      date: d.resolved,
      dateStr: d.resolved.toLocaleDateString("en-CA"),
      category: "important_dates" as const,
      color: catColors.important_dates,
      calendarHoliday: {
        id: d.id,
        title: d.label,
        date: d.resolved.toLocaleDateString("en-CA"),
        category: "important_dates",
        color: catColors.important_dates,
        event: d.subtitle ? { id: d.id, startTime: null, endTime: null, location: null, description: d.subtitle, htmlContent: null, lightboxWidth: null, flyer: null } : null,
      } as CalendarHoliday,
    }));

  // Fill remaining slots with calendar events (excluding important_dates)
  const calendarSlots = Math.max(0, TOTAL_CAP - resolvedImportant.length);
  const calendarFill: UnifiedItem[] = calendarHolidays
    .filter((h) => h.category !== "important_dates")
    .slice(0, calendarSlots)
    .map((h) => ({
      id: h.id,
      title: h.title,
      subtitle: null,
      date: new Date(h.date + "T00:00:00"),
      dateStr: h.date,
      category: h.category,
      color: catColors[h.category] || h.color || "#6b7280",
      calendarHoliday: h,
    }));

  // Merge and sort all by date
  const unified = [...resolvedImportant, ...calendarFill].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const isLoading = !loaded || calLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-center gap-2">
          <CalendarClock className="w-4 h-4 text-brand-blue" />
          <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">Important Dates</h3>
        </div>
        <div className="flex-1 p-2 animate-pulse grid grid-cols-2 grid-rows-3 gap-1.5 min-h-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
    <div className="px-3 py-1.5 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-center gap-2">
  <CalendarClock className="w-3.5 h-3.5 text-brand-blue shrink-0" />
  <h3 className="text-xs font-bold text-brand-blue tracking-wide uppercase">Upcoming Dates</h3>
</div>

      {/* Grid — 3 rows × 2 cols */}
      <div className="flex-1 px-2 py-1 min-h-0">
        {unified.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-40" />
            No upcoming dates.
          </div>
        ) : (
          <div className="grid grid-cols-2 grid-rows-3 gap-1 min-h-0">
            {unified.map((item, i) => {
              const days = daysUntil(item.date);
              const isToday = days === 0;
              const isSoon = days > 0 && days <= 7;

              return (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => item.calendarHoliday && setSelectedHoliday(item.calendarHoliday)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`relative flex flex-col justify-center rounded-md border border-gray-100 dark:border-gray-700 pl-3.5 pr-2 py-1 text-left w-full cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${isToday ? "ring-2 ring-brand-blue/30 bg-brand-blue/5" : "bg-gray-50/50 dark:bg-gray-800/50"}`}
                >
                  {/* Left accent bar */}
                  <div
                    className="absolute left-1.5 top-1.5 bottom-1.5 w-[3px] rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {/* Title */}
                  <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 leading-tight line-clamp-1">
                    {item.title}{item.subtitle && <span className="font-normal text-gray-500 dark:text-gray-400"> ({item.subtitle})</span>}
                  </p>
                  {/* Date + countdown */}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {formatDate(item.date)}
                    </span>
                    {isToday && <span className="text-[11px] font-medium text-brand-blue">Today!</span>}
                    {isSoon && !isToday && (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{daysLabel(days)}</span>
                    )}
                    {!isToday && !isSoon && (
                      <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{daysLabel(days)}</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-3 py-0.5 border-t border-gray-100 dark:border-gray-800">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 text-[11px] text-brand-blue hover:underline font-medium"
        >
          View full calendar <ExternalLink className="w-3 h-3" />
        </Link>
        <button
          onClick={() => refetch()}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3 text-brand-grey" />
        </button>
      </div>

      {/* Holiday Detail Dialog */}
      <HolidayDetailDialog
        holiday={selectedHoliday}
        onClose={() => setSelectedHoliday(null)}
        title={selectedHoliday?.category === "important_dates" ? "Important Date" : "Holiday Details"}
        dateLabel={selectedHoliday ? formatDate(new Date(selectedHoliday.date + "T00:00:00")) : ""}
        categoryColor={catColors[selectedHoliday?.category || ""] || "#6b7280"}
        categoryLabel={
          selectedHoliday
            ? CATEGORY_LABELS[selectedHoliday.category] ||
              selectedHoliday.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            : ""
        }
      />
    </div>
  );
}
