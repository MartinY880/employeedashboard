// ProConnect — Full Calendar Page
// Monthly calendar view with category filters, powered by mproscalendar proxy

"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  LayoutGrid,
  RefreshCw,
  Star,
  Flag,
  PartyPopper,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCalendar, type CalendarHoliday } from "@/hooks/useCalendar";
import { useSounds } from "@/components/shared/SoundProvider";

// ── Category Config ──────────────────────────────────────
const CATEGORIES = [
  { key: "all", label: "All", icon: Calendar, color: "#06427F" },
  { key: "federal", label: "Federal", icon: Flag, color: "#1e40af" },
  { key: "company", label: "Company", icon: Building2, color: "#06427F" },
  { key: "fun", label: "Fun", icon: PartyPopper, color: "#16a34a" },
  { key: "observance", label: "Observance", icon: Star, color: "#9333ea" },
] as const;

const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  federal: "#1e40af",
  company: "#06427F",
  fun: "#16a34a",
  observance: "#9333ea",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Helpers ──────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

// ── Page Component ───────────────────────────────────────

export default function CalendarPage() {
  const { playClick } = useSounds();

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const { holidays, isLoading, isEmpty, refetch } = useCalendar({ year: viewYear });
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedHoliday, setSelectedHoliday] = useState<CalendarHoliday | null>(null);
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(DEFAULT_CATEGORY_COLORS);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/calendar/settings?key=category_colors")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        setCategoryColors((prev) => ({ ...prev, ...data }));
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  const getCategoryColor = (category: string) => categoryColors[category] || DEFAULT_CATEGORY_COLORS[category] || "#6b7280";

  const todayStr = today.toISOString().split("T")[0];

  // Filter holidays by active category
  const filteredHolidays = useMemo(() => {
    if (activeCategory === "all") return holidays;
    return holidays.filter((h) => h.category === activeCategory);
  }, [holidays, activeCategory]);

  // Map holidays by date string for quick lookup in grid
  const holidaysByDate = useMemo(() => {
    const map: Record<string, CalendarHoliday[]> = {};
    for (const h of filteredHolidays) {
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push(h);
    }
    return map;
  }, [filteredHolidays]);

  // Holidays in current viewing month (for list view)
  const monthHolidays = useMemo(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
    return filteredHolidays
      .filter((h) => h.date.startsWith(prefix))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredHolidays, viewMonth, viewYear]);

  // Navigation
  const goToPrevMonth = () => {
    playClick();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    playClick();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const goToToday = () => {
    playClick();
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
  };

  // Calendar grid
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const gridCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) gridCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) gridCells.push(d);
  // Pad to full weeks
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  if (isLoading) {
    return (
      <div className="max-w-[1920px] mx-auto px-6 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1920px] mx-auto px-6 py-6 space-y-5"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Calendar</h1>
          <p className="text-sm text-brand-grey mt-0.5">
            Federal holidays, company events & fun days
            {isEmpty && (
              <span className="ml-2 text-[10px] text-brand-grey/60 italic">(no holidays — add them in Admin)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setViewMode("grid"); playClick(); }}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-brand-blue text-white" : "bg-white text-brand-grey hover:bg-gray-50"}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setViewMode("list"); playClick(); }}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-brand-blue text-white" : "bg-white text-brand-grey hover:bg-gray-50"}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-brand-grey"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(cat.key); playClick(); }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                isActive
                  ? "bg-brand-blue text-white border-brand-blue shadow-sm"
                  : "bg-white text-brand-grey border-gray-200 hover:border-brand-blue/40 hover:text-brand-blue"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-bold text-gray-900 min-w-[180px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={goToToday}
          className="text-xs"
        >
          Today
        </Button>
      </div>

      {/* Calendar View */}
      <AnimatePresence mode="wait">
        {viewMode === "grid" ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_NAMES.map((day) => (
                <div key={day} className="text-center text-xs font-semibold text-brand-grey uppercase tracking-wider py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="grid grid-cols-7 gap-1">
              {gridCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`empty-${idx}`} className="h-28 rounded-lg bg-gray-50/50" />;
                }
                const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayHolidays = holidaysByDate[dateStr] || [];
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6;

                return (
                  <motion.div
                    key={dateStr}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.15, delay: idx * 0.008 }}
                    className={`min-h-28 rounded-lg border p-1.5 transition-all ${
                      isToday
                        ? "border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue/20"
                        : isPast
                          ? "border-gray-100 bg-gray-50/50 opacity-60"
                          : isWeekend
                            ? "border-gray-100 bg-gray-50/30"
                            : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-1 ${
                      isToday ? "text-brand-blue" : isPast ? "text-gray-400" : "text-gray-700"
                    }`}>
                      {day}
                      {isToday && <span className="ml-1 text-[9px] text-brand-blue font-bold">TODAY</span>}
                    </div>
                    <div className="space-y-0.5">
                      {dayHolidays.map((h) => {
                        const categoryColor = getCategoryColor(h.category);
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => {
                              setSelectedHoliday(h);
                              playClick();
                            }}
                            className="w-full text-left text-[10px] font-medium rounded px-1 py-0.5 whitespace-normal break-words leading-tight hover:opacity-90"
                            style={getBadgeStyle(categoryColor)}
                            title={`${h.title} (click for details)`}
                          >
                            {h.title}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          /* List View */
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {monthHolidays.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Calendar className="w-10 h-10 text-brand-grey/30 mx-auto mb-3" />
                <p className="text-sm text-brand-grey">No events in {MONTH_NAMES[viewMonth]}</p>
              </div>
            ) : (
              monthHolidays.map((h, i) => {
                const categoryColor = getCategoryColor(h.category);
                const days = daysUntil(h.date);
                const isToday = days === 0;
                const isPast = days < 0;

                return (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.04 }}
                    className={`flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 hover:shadow-md transition-shadow cursor-pointer ${
                      isToday ? "ring-1 ring-brand-blue/20" : ""
                    } ${isPast ? "opacity-50" : ""}`}
                    onClick={() => {
                      setSelectedHoliday(h);
                      playClick();
                    }}
                  >
                    {/* Date block */}
                    <div className="text-center min-w-[50px]">
                      <div className="text-2xl font-bold text-gray-800">
                        {new Date(h.date + "T00:00:00").getDate()}
                      </div>
                      <div className="text-[10px] font-semibold text-brand-grey uppercase">
                        {new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                    </div>

                    {/* Color bar */}
                    <div className="w-1 h-12 rounded-full" style={{ backgroundColor: categoryColor }} />

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800">{h.title}</div>
                      <div className="text-xs text-brand-grey">{formatDate(h.date)}</div>
                    </div>

                    {/* Category + timing */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isToday && (
                        <Badge className="bg-brand-blue text-white text-[10px]">Today!</Badge>
                      )}
                      {!isPast && !isToday && days <= 14 && (
                        <span className="text-[11px] text-amber-600 font-medium">
                          in {days}d
                        </span>
                      )}
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-2 py-0.5 font-medium"
                        style={getBadgeStyle(categoryColor)}
                      >
                        {h.category}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!selectedHoliday} onOpenChange={(open) => !open && setSelectedHoliday(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-gray-900">Holiday Details</DialogTitle>
          </DialogHeader>
          {selectedHoliday && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-brand-grey">Title</div>
                <div className="font-semibold text-gray-900 break-words">{selectedHoliday.title}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-brand-grey">Date</div>
                  <div className="text-gray-800">{formatDate(selectedHoliday.date)}</div>
                </div>
                <div>
                  <div className="text-xs text-brand-grey">Category</div>
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[10px] px-2 py-0.5 font-medium"
                    style={getBadgeStyle(getCategoryColor(selectedHoliday.category))}
                  >
                    {selectedHoliday.category}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
