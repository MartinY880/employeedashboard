// ProConnect — Celebrations Widget
// List-style feed for employee celebrations (birthdays, anniversaries, exam passes).
// Mimics the compact card style of MyShare.

"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, CalendarHeart, GraduationCap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentSection } from "@/components/shared/CommentSection";
import type { UnifiedComment } from "@/types";

interface CelebrationItem {
  id: string;
  type: "birthday" | "anniversary" | "exam";
  employeeName: string;
  employeeId: string | null;
  email: string;
  detail: string;
  commentCount: number;
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
  { key: "exam", label: "Exams", icon: GraduationCap, color: "#d97706" },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Comment Thread for Celebration ─────────────────── */

function CelebrationCommentThread({ celebrationId, commentCount }: { celebrationId: string; commentCount: number }) {
  const fetchComments = useCallback(async (entityId: string): Promise<UnifiedComment[]> => {
    const res = await fetch(`/api/celebrations/comments?celebrationId=${entityId}`);
    const data = await res.json();
    return data.comments || [];
  }, []);

  const submitComment = useCallback(async (entityId: string, content: string, parentId?: string): Promise<UnifiedComment> => {
    const res = await fetch("/api/celebrations/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ celebrationId: entityId, content, parentId: parentId || null }),
    });
    const data = await res.json();
    return data.comment;
  }, []);

  const likeComment = useCallback(async (_entityId: string, commentId: string): Promise<void> => {
    await fetch("/api/celebrations/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
  }, []);

  const deleteComment = useCallback(async (_entityId: string, commentId: string): Promise<void> => {
    await fetch(`/api/celebrations/comments?id=${commentId}`, { method: "DELETE" });
  }, []);

  return (
    <CommentSection
      entityId={celebrationId}
      commentCount={commentCount}
      compact
      onFetchComments={fetchComments}
      onSubmit={submitComment}
      onLike={likeComment}
      onDelete={deleteComment}
    />
  );
}

function CelebrationRow({ item }: { item: CelebrationItem }) {
  const { accent, icon: Icon } = TYPE_CONFIG[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className="px-3.5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1">
        {/* Photo */}
        <div className="relative shrink-0">
          <div
            className="h-14 w-14 rounded-full overflow-hidden ring-[1.5px] ring-offset-1 ring-offset-white dark:ring-offset-gray-900"
            style={{ ["--tw-ring-color" as string]: `${accent}50` }}
          >
            {item.employeeId ? (
              <img
                src={`/api/directory/photo?userId=${encodeURIComponent(item.employeeId)}&name=${encodeURIComponent(item.employeeName)}&size=240x240`}
                alt={item.employeeName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="h-full w-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
              >
                {getInitials(item.employeeName)}
              </div>
            )}
          </div>
          {/* Type badge */}
          <div
            className="absolute -bottom-0.5 -right-0.5 h-[18px] w-[18px] rounded-full flex items-center justify-center border-[1.5px] border-white dark:border-gray-900"
            style={{ backgroundColor: accent }}
          >
            <Icon className="h-2.5 w-2.5 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-gray-900 dark:text-gray-50 leading-tight truncate">
            {item.employeeName}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5 truncate">
            {item.detail}
          </p>
        </div>

        {/* Comment chip — right */}
        <CelebrationCommentThread celebrationId={item.id} commentCount={item.commentCount ?? 0} />
      </div>
    </motion.div>
  );
}

export function CelebrationsBanner({ selectedDate, onDateChange }: { selectedDate?: string; onDateChange?: (date: string) => void }) {
  const [data, setData] = useState<CelebrationsData | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showCount, setShowCount] = useState(6);

  // Determine if viewing today
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const dateToFetch = selectedDate || todayStr;
  const isToday = dateToFetch === todayStr;

  useEffect(() => {
    const url = isToday ? "/api/celebrations" : `/api/celebrations?date=${dateToFetch}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: CelebrationsData) => {
        if (d?.items) setData(d);
        else setData({ items: [], hasBirthdays: false, hasAnniversaries: false, hasExams: false });
      })
      .catch(() => {});
    setFilter("all");
    setShowCount(6);
  }, [dateToFetch, isToday]);

  if (!data || data.items.length === 0) return (
    <div className="px-3.5 py-6 text-center text-xs text-gray-400">
      No celebrations{isToday ? " today" : ` on ${dateToFetch}`}.
    </div>
  );

  // Build available filters (hide Exams for past dates since they're ephemeral)
  const availableFilters = FILTERS.filter(
    (f) =>
      f.key === "all" ||
      (f.key === "birthday" && data.hasBirthdays) ||
      (f.key === "anniversary" && data.hasAnniversaries) ||
      (f.key === "exam" && data.hasExams && isToday)
  );

  // Filter items
  const filtered =
    filter === "all" ? data.items : data.items.filter((i) => i.type === filter);

  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {/* Filter tabs */}
      {availableFilters.length > 1 && (
        <div className="px-3.5 py-2 flex items-center gap-0.5">
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {availableFilters.map((f) => {
              const FIcon = f.icon;
              const isActive = filter === f.key;
              return (
                <motion.button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setShowCount(6); }}
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
                  <FIcon className="h-3 w-3 relative z-10" />
                  <span className="relative z-10 hidden sm:inline">{f.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
        <AnimatePresence mode="popLayout">
          {visible.length > 0 ? (
            visible.map((item) => (
              <CelebrationRow key={item.id} item={item} />
            ))
          ) : (
            <p className="text-center text-xs text-gray-400 py-6">
              No celebrations for this filter.
            </p>
          )}
        </AnimatePresence>
      </div>

      {/* View More */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowCount((c) => c + 6)}
          className="w-full py-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors"
        >
          View More ({filtered.length - showCount} remaining)
        </button>
      )}
    </div>
  );
}
