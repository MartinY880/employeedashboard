// ProConnect — Celebrations Banner Widget
// Premium 3D rotating carousel for employee celebrations.
// Shows birthdays, anniversaries, and exam passes with category filters.

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, CalendarHeart, GraduationCap, Sparkles } from "lucide-react";
import {
  ThreeDImageCarousel,
  type CarouselItem,
} from "@/components/ui/three-d-image-carousel";
import { cn } from "@/lib/utils";

interface CelebrationItem {
  id: string;
  type: "birthday" | "anniversary" | "exam";
  employeeName: string;
  employeeId: string | null;
  email: string;
  detail: string;
}

interface CelebrationsData {
  items: CelebrationItem[];
  hasBirthdays: boolean;
  hasAnniversaries: boolean;
  hasExams: boolean;
}

type FilterType = "all" | "birthday" | "anniversary" | "exam";

const TYPE_CONFIG: Record<
  CelebrationItem["type"],
  { accent: string; accentLight: string; label: string; icon: typeof Cake }
> = {
  birthday: { accent: "#db2777", accentLight: "#fce7f3", label: "Birthday", icon: Cake },
  anniversary: { accent: "#059669", accentLight: "#d1fae5", label: "Anniversary", icon: CalendarHeart },
  exam: { accent: "#d97706", accentLight: "#fef3c7", label: "Exam Passed", icon: GraduationCap },
};

const FILTERS: { key: FilterType; label: string; icon: typeof Sparkles; color: string }[] = [
  { key: "all", label: "All", icon: Sparkles, color: "#06427F" },
  { key: "birthday", label: "Birthdays", icon: Cake, color: "#db2777" },
  { key: "anniversary", label: "Anniversaries", icon: CalendarHeart, color: "#059669" },
  { key: "exam", label: "Exams Passed", icon: GraduationCap, color: "#d97706" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function CelebrationCard({ item }: { item: CelebrationItem }) {
  const { accent, accentLight, label, icon: Icon } = TYPE_CONFIG[item.type];

  return (
    <div className="w-[150px]">
      <div
        className="relative rounded-2xl overflow-hidden bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 p-3.5 pb-3 flex flex-col items-center text-center transition-all duration-200"
        style={{
          boxShadow: `0 1px 3px rgba(0,0,0,0.06), 0 6px 16px ${accent}12`,
        }}
      >
        {/* Top accent bar */}
        <div
          className="absolute top-0 inset-x-0 h-[3px]"
          style={{ background: `linear-gradient(90deg, ${accent}00, ${accent}, ${accent}00)` }}
        />

        {/* Photo */}
        <div className="relative mb-2.5">
          <div
            className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800"
            style={{ ["--tw-ring-color" as string]: `${accent}40` }}
          >
            {item.employeeId ? (
              <img
                src={`/api/directory/photo?userId=${encodeURIComponent(item.employeeId)}&name=${encodeURIComponent(item.employeeName)}&size=240x240`}
                alt={item.employeeName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
              >
                {getInitials(item.employeeName)}
              </div>
            )}
          </div>
          {/* Category badge */}
          <div
            className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-gray-800"
            style={{ backgroundColor: accent }}
          >
            <Icon className="h-2.5 w-2.5 text-white" />
          </div>
        </div>

        {/* Name */}
        <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-50 leading-snug truncate w-full">
          {item.employeeName}
        </p>

        {/* Detail */}
        <p
          className="text-[11px] font-medium leading-snug mt-0.5 truncate w-full"
          style={{ color: accent }}
        >
          {item.detail}
        </p>

        {/* Category pill */}
        <div
          className="mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: accentLight, color: accent }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

export function CelebrationsBanner() {
  const [data, setData] = useState<CelebrationsData | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    fetch("/api/celebrations")
      .then((r) => r.json())
      .then((d: CelebrationsData) => {
        if (d?.items) setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data || data.items.length === 0) return null;

  // Build available filters
  const availableFilters = FILTERS.filter(
    (f) =>
      f.key === "all" ||
      (f.key === "birthday" && data.hasBirthdays) ||
      (f.key === "anniversary" && data.hasAnniversaries) ||
      (f.key === "exam" && data.hasExams)
  );

  // Filter items
  const filtered =
    filter === "all" ? data.items : data.items.filter((i) => i.type === filter);

  // Convert to carousel items
  const carouselItems: CarouselItem[] = filtered.map((item) => ({
    id: item.id,
    content: <CelebrationCard item={item} />,
  }));

  return (
    <section className="mb-5">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-blue" />
            <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
              Celebrations
            </h3>
            <span className="text-[10px] font-semibold bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded-md tabular-nums">
              {data.items.length}
            </span>
          </div>

          {/* Filter tabs */}
          {availableFilters.length > 1 && (
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {availableFilters.map((f) => {
                const Icon = f.icon;
                const isActive = filter === f.key;
                return (
                  <motion.button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "relative flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors duration-150",
                      isActive
                        ? "text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="celebrations-filter-bg"
                        className="absolute inset-0 rounded-md"
                        style={{ backgroundColor: f.color }}
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <Icon className="h-3 w-3 relative z-10" />
                    <span className="relative z-10 hidden sm:inline">{f.label}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3D Carousel */}
        <div className="px-2 pt-3 pb-2.5">
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {carouselItems.length > 0 ? (
                <ThreeDImageCarousel
                  items={carouselItems}
                  autoRotate
                  autoRotateInterval={4000}
                  height={200}
                />
              ) : (
                <p className="text-center text-xs text-gray-400 py-6">
                  No celebrations for this filter.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
