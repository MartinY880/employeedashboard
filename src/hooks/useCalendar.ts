// ProConnect — useCalendar Hook
// Fetches upcoming holidays from the native calendar API (PostgreSQL)

"use client";

import { useState, useEffect, useCallback } from "react";

export interface CalendarHoliday {
  id: string;
  title: string;
  date: string;
  category: string;
  color: string;
  source?: string;
  visible?: boolean;
  recurring?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  federal: "#1e40af",
  company: "#06427F",
  fun: "#16a34a",
  observance: "#9333ea",
};

interface UseCalendarOptions {
  /** Max upcoming holidays to return (widget mode). Ignored when year is set. */
  limit?: number;
  /** Fetch ALL visible holidays for this year (full-calendar mode). */
  year?: number;
}

export function useCalendar(limitOrOpts: number | UseCalendarOptions = 6) {
  const opts: UseCalendarOptions =
    typeof limitOrOpts === "number" ? { limit: limitOrOpts } : limitOrOpts;

  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchYear = opts.year ?? new Date().getFullYear();
      const res = await fetch(`/api/calendar?year=${fetchYear}`);

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();

      if (data.error || !Array.isArray(data)) {
        throw new Error("Invalid response");
      }

      let result: CalendarHoliday[];

      if (opts.year !== undefined) {
        // Full-year mode: return all holidays sorted by date (no upcoming filter, no limit)
        result = data
          .sort((a: CalendarHoliday, b: CalendarHoliday) => a.date.localeCompare(b.date))
          .map((h: CalendarHoliday) => ({
            ...h,
            color: h.color || CATEGORY_COLORS[h.category] || "#06427F",
          }));
      } else {
        // Widget mode: upcoming holidays only, limited
        const today = new Date().toISOString().split("T")[0];
        result = data
          .filter((h: CalendarHoliday) => h.date >= today)
          .sort((a: CalendarHoliday, b: CalendarHoliday) => a.date.localeCompare(b.date))
          .slice(0, opts.limit ?? 6)
          .map((h: CalendarHoliday) => ({
            ...h,
            color: h.color || CATEGORY_COLORS[h.category] || "#06427F",
          }));
      }

      setHolidays(result);
      setIsEmpty(result.length === 0);
    } catch {
      setHolidays([]);
      setIsEmpty(true);
    } finally {
      setIsLoading(false);
    }
  }, [opts.limit, opts.year]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  return { holidays, isLoading, isEmpty, refetch: fetchHolidays };
}
