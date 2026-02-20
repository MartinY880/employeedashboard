// ProConnect — useCalendar Hook
// Fetches upcoming holidays from the calendar API proxy

"use client";

import { useState, useEffect, useCallback } from "react";

export interface CalendarHoliday {
  id: number;
  title: string;
  date: string;
  category: string;
  color: string;
  source?: string;
  visible?: boolean;
  recurring?: boolean;
}

// Demo data — used when calendar service is unavailable
const DEMO_HOLIDAYS: CalendarHoliday[] = [
  { id: 1, title: "Presidents' Day", date: "2026-02-16", category: "federal", color: "#1e40af" },
  { id: 2, title: "Employee Appreciation Day", date: "2026-03-06", category: "company", color: "#06427F" },
  { id: 3, title: "St. Patrick's Day", date: "2026-03-17", category: "fun", color: "#16a34a" },
  { id: 4, title: "Good Friday", date: "2026-04-03", category: "federal", color: "#1e40af" },
  { id: 5, title: "Memorial Day", date: "2026-05-25", category: "federal", color: "#1e40af" },
  { id: 6, title: "Independence Day", date: "2026-07-04", category: "federal", color: "#1e40af" },
  { id: 7, title: "Company Summer BBQ", date: "2026-06-19", category: "company", color: "#06427F" },
  { id: 8, title: "Labor Day", date: "2026-09-07", category: "federal", color: "#1e40af" },
];

const CATEGORY_COLORS: Record<string, string> = {
  federal: "#1e40af",
  company: "#06427F",
  fun: "#16a34a",
  observance: "#9333ea",
};

export function useCalendar(limit: number = 6) {
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`/api/calendar?year=${year}`);

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const data = await res.json();

      if (data.error || !Array.isArray(data)) {
        throw new Error("Invalid response");
      }

      // Filter to upcoming holidays & sort by date
      const today = new Date().toISOString().split("T")[0];
      const upcoming = data
        .filter((h: CalendarHoliday) => h.date >= today)
        .sort((a: CalendarHoliday, b: CalendarHoliday) => a.date.localeCompare(b.date))
        .slice(0, limit)
        .map((h: CalendarHoliday) => ({
          ...h,
          color: h.color || CATEGORY_COLORS[h.category] || "#06427F",
        }));

      setHolidays(upcoming);
      setIsDemo(false);
    } catch {
      // Calendar service unavailable — show demo data
      const today = new Date().toISOString().split("T")[0];
      const upcoming = DEMO_HOLIDAYS
        .filter((h) => h.date >= today)
        .slice(0, limit);
      setHolidays(upcoming);
      setIsDemo(true);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  return { holidays, isLoading, isDemo, refetch: fetchHolidays };
}
