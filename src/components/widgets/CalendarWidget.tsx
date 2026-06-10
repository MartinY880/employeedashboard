// ProConnect — CalendarWidget
// Upcoming holidays from the Calendar app proxy (center column)

// FILE NOT USED AFTER COMBINING WITH IMPORTANT DATES, BUT KEEPING FOR REFERENCE IN CASE WE WANT TO REVERT BACK TO SEPARATE WIDGETS 

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { HolidayDetailDialog } from "@/components/widgets/HolidayDetailDialog";
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

      <HolidayDetailDialog
        holiday={selectedHoliday}
        onClose={() => setSelectedHoliday(null)}
        title="Holiday Details"
        dateLabel={selectedHoliday ? formatDate(selectedHoliday.date) : ""}
        categoryColor={getCategoryColor(selectedHoliday?.category ?? "")}
        categoryLabel={getCategoryLabel(selectedHoliday?.category ?? "")}
      />
    </div>
  );
}
