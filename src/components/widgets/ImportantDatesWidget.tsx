// ProConnect — Important Dates Widget
// Horizontal row of upcoming important dates displayed on the dashboard

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import type { ImportantDate } from "@/types";

/** Parse a DB date string into a local Date without timezone shift */
function parseUTCDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Resolve the next occurrence based on recurrence type */
function resolveDate(entry: ImportantDate): Date {
  const d = parseUTCDate(entry.date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (entry.recurType === "first_workday") {
    // First workday of the month: 1st, adjusted to Monday if Sat/Sun
    let candidate = new Date(today.getFullYear(), today.getMonth(), 1);
    candidate = adjustToWorkday(candidate);
    if (candidate < today) {
      candidate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      candidate = adjustToWorkday(candidate);
    }
    return candidate;
  }

  if (entry.recurType === "monthly") {
    const day = d.getDate(); // already local from parseUTCDate
    let next = new Date(today.getFullYear(), today.getMonth(), day);
    if (next < today) {
      next = new Date(today.getFullYear(), today.getMonth() + 1, day);
    }
    return next;
  }

  // No recurrence — return the local-correct date
  return d;
}

/** If the date falls on Saturday or Sunday, move to Monday */
function adjustToWorkday(d: Date): Date {
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (dow === 6) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2);
  if (dow === 0) return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return d;
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}

function formatDay(d: Date): string {
  return String(d.getDate());
}

function formatWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

/** Days until the date from today */
function daysUntil(d: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function daysLabel(n: number): string {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  return `${n} days`;
}

// Accent colors to rotate through for variety
const ACCENT_COLORS = [
  { bg: "bg-brand-blue/10 dark:bg-brand-blue/20", border: "border-brand-blue/20 dark:border-brand-blue/40", text: "text-brand-blue", month: "text-brand-blue" },
  { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800/40", text: "text-pink-600 dark:text-pink-400", month: "text-pink-500 dark:text-pink-400" },
  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/40", text: "text-emerald-600 dark:text-emerald-400", month: "text-emerald-500 dark:text-emerald-400" },
  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/40", text: "text-amber-600 dark:text-amber-400", month: "text-amber-500 dark:text-amber-400" },
  { bg: "bg-violet-50 dark:bg-violet-950/30", border: "border-violet-200 dark:border-violet-800/40", text: "text-violet-600 dark:text-violet-400", month: "text-violet-500 dark:text-violet-400" },
  { bg: "bg-cyan-50 dark:bg-cyan-950/30", border: "border-cyan-200 dark:border-cyan-800/40", text: "text-cyan-600 dark:text-cyan-400", month: "text-cyan-500 dark:text-cyan-400" },
];

export function ImportantDatesWidget() {
  const [dates, setDates] = useState<ImportantDate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/important-dates");
        const data = await res.json();
        setDates(data.dates || []);
      } catch {
        // silent
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Resolve dates, filter to current + next month, then sort
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const curDay = now.getDate();

  const sorted = dates
    .map((d) => ({ ...d, resolved: resolveDate(d) }))
    .filter((d) => {
      const rYear = d.resolved.getFullYear();
      const rMonth = d.resolved.getMonth();
      // Always show current month
      if (rYear === curYear && rMonth === curMonth) return true;
      // After day 28, also show next month's dates
      if (curDay >= 28) {
        const nextMonth = curMonth === 11 ? 0 : curMonth + 1;
        const nextYear = curMonth === 11 ? curYear + 1 : curYear;
        if (rYear === nextYear && rMonth === nextMonth) return true;
      }
      return false;
    })
    .sort((a, b) => a.resolved.getTime() - b.resolved.getTime());

  if (!loaded) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-center gap-2">
          <CalendarClock className="w-4 h-4 text-brand-blue" />
          <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">Important Dates</h3>
        </div>
        <div className="flex-1 p-3.5 animate-pulse">
          <div className="flex flex-wrap justify-center gap-2.5">
            <div className="h-[74px] w-[280px] rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-[74px] w-[280px] rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-[74px] w-[280px] rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-[74px] w-[280px] rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-center gap-2">
        <CalendarClock className="w-4 h-4 text-brand-blue" />
        <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">Important Dates</h3>
      </div>

      {/* Body */}
      <div className="flex-1 p-3.5">
        {sorted.length === 0 ? (
          <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
            No upcoming dates this cycle.
          </div>
        ) : (
          <div className="h-full flex flex-wrap justify-center gap-2.5 content-center">
            {sorted.map((entry, i) => {
              const resolved = entry.resolved;
              const days = daysUntil(resolved);
              const color = ACCENT_COLORS[i % ACCENT_COLORS.length];
              const isToday = days === 0;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 min-h-[74px] w-[280px] ${color.bg} ${color.border} ${isToday ? "ring-2 ring-brand-blue/30 dark:ring-brand-blue/40" : ""}`}
                >
                  <div className="flex flex-col items-center justify-center w-10 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider leading-none ${color.month}`}>
                      {formatMonth(resolved)}
                    </span>
                    <span className={`text-xl font-extrabold leading-tight ${color.text}`}>
                      {formatDay(resolved)}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none">
                      {formatWeekday(resolved)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">
                      {entry.label}
                    </p>
                    {entry.subtitle && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5 line-clamp-2">
                        {entry.subtitle}
                      </p>
                    )}
                    <p className={`text-[10px] mt-0.5 ${isToday ? "font-bold text-brand-blue" : "text-gray-400 dark:text-gray-500"}`}>
                      {days >= 0 ? daysLabel(days) : `${Math.abs(days)}d ago`}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
