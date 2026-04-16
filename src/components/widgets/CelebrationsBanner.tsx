// ProConnect — Celebrations Widget
// List-style feed for employee celebrations (birthdays, anniversaries, exam passes).
// Mimics the compact card style of MyShare.

"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, CalendarHeart, GraduationCap, Sparkles, CalendarDays, Heart } from "lucide-react";
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
  examDate?: string;
  commentCount: number;
  likeCount: number;
  userLiked: boolean;
}

interface CelebrationsData {
  items: CelebrationItem[];
  hasBirthdays: boolean;
  hasAnniversaries: boolean;
  hasExams: boolean;
  nextUp: NextUpItem | null;
}

type FilterType = "all" | "birthday" | "anniversary" | "exam";

interface NextUpItem {
  employeeName: string;
  employeeId: string | null;
  email: string;
  type: "birthday" | "anniversary";
  eventDate: string; // YYYY-MM-DD
  daysAway: number;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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
      initiallyExpanded
      previewCount={2}
      onFetchComments={fetchComments}
      onSubmit={submitComment}
      onLike={likeComment}
      onDelete={deleteComment}
    />
  );
}

function CelebrationRow({ item }: { item: CelebrationItem }) {
  const { accent, icon: Icon } = TYPE_CONFIG[item.type];
  const [liked, setLiked] = useState(item.userLiked);
  const [likeCount, setLikeCount] = useState(item.likeCount ?? 0);

  const handleLike = async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    try {
      await fetch("/api/celebrations/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrationId: item.id }),
      });
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
    }
  };

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
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight truncate">
              {item.detail}
            </p>
            {item.type === "exam" && item.examDate && (
              <span className="shrink-0 text-[10px] font-medium text-gray-400 dark:text-gray-500 tabular-nums">
                {item.examDate}
              </span>
            )}
          </div>
        </div>

        {/* Like button — top right */}
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 group/like transition-colors self-start mt-0.5"
        >
          <Heart className={`w-4 h-4 transition-all ${
            liked
              ? "fill-rose-500 text-rose-500 scale-110"
              : "text-gray-400 dark:text-gray-500 group-hover/like:text-rose-500"
          }`} />
          {likeCount > 0 && (
            <span className={`text-[11px] font-semibold tabular-nums ${
              liked ? "text-rose-500" : "text-gray-500 dark:text-gray-400"
            }`}>
              {likeCount}
            </span>
          )}
        </button>
      </div>

      {/* Comment thread — full width, left aligned */}
      <div className="mt-2">
        <CelebrationCommentThread celebrationId={item.id} commentCount={item.commentCount ?? 0} />
      </div>
    </motion.div>
  );
}

export function CelebrationsBanner({ selectedDate, onDateChange }: { selectedDate?: string; onDateChange?: (date: string) => void }) {
  const [data, setData] = useState<CelebrationsData | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showCount, setShowCount] = useState(5);
  const [nextUp, setNextUp] = useState<NextUpItem | null>(null);

  // Determine if viewing today
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const dateToFetch = selectedDate || todayStr;
  const isToday = dateToFetch === todayStr;

  useEffect(() => {
    const url = isToday ? "/api/celebrations" : `/api/celebrations?date=${dateToFetch}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: CelebrationsData) => {
        if (d?.items) {
          setData(d);
          setNextUp(d.nextUp ?? null);
        } else {
          setData({ items: [], hasBirthdays: false, hasAnniversaries: false, hasExams: false, nextUp: null });
          setNextUp(null);
        }
      })
      .catch(() => {});
    setFilter("all");
    setShowCount(5);
  }, [dateToFetch, isToday]);

  // Build available filters
  // If there is anything at all for this day, always show Birthday + Anniversary tabs.
  // Exams tab only shows on today when there are exam items.
  const hasAnything = (data?.hasBirthdays || data?.hasAnniversaries || data?.hasExams);
  const availableFilters = hasAnything
    ? FILTERS.filter(
        (f) =>
          f.key === "all" ||
          f.key === "birthday" ||
          f.key === "anniversary" ||
          (f.key === "exam" && data?.hasExams && isToday)
      )
    : [];

  // Filter items
  const allItems = data?.items ?? [];
  const filtered = filter === "all" ? allItems : allItems.filter((i) => i.type === filter);
  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  // ── Empty state helpers ─────────────────────────────────
  const isEmptyState = filtered.length === 0;

  // "Nothing today" only when no items at all (filter === "all" or no data)
  const isFullyEmpty = !hasAnything;

  const emptyHeading = isFullyEmpty
    ? (isToday ? "Nothing today" : (() => {
        const d = new Date(dateToFetch + "T12:00:00");
        return `Nothing on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      })())
    : filter === "birthday" ? "No birthdays"
    : filter === "anniversary" ? "No anniversaries"
    : filter === "exam" ? "No exam passes"
    : (isToday ? "Nothing today" : (() => {
        const d = new Date(dateToFetch + "T12:00:00");
        return `Nothing on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      })());

  const emptySubtitle = "";

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {/* Filter tabs — shown when there's anything to display */}
      {availableFilters.length > 1 && (
        <div className="px-3.5 py-2 flex items-center gap-0.5">
          <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {availableFilters.map((f) => {
              const FIcon = f.icon;
              const isActive = filter === f.key;
              return (
                <motion.button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setShowCount(5); }}
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

      {isEmptyState ? (
        <>
          {/* Empty message */}
          <div className={`px-4 flex flex-col items-center justify-center text-center gap-1.5 ${isFullyEmpty ? "py-8" : "py-5"}`}>
            <CalendarDays className={`text-gray-300 dark:text-gray-600 mb-1 ${isFullyEmpty ? "h-7 w-7" : "h-5 w-5"}`} />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{emptyHeading}</p>
          </div>

          {/* Next up strip — only on fully empty days */}
          {isFullyEmpty && nextUp && (
            <div className="px-3.5 py-2.5">
              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Next up</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Avatar */}
                  {(() => {
                    const accent = TYPE_CONFIG[nextUp.type]?.accent ?? "#06427F";
                    return (
                      <div className="relative shrink-0">
                        <div
                          className="h-9 w-9 rounded-full overflow-hidden ring-[1.5px] ring-offset-1 ring-offset-white dark:ring-offset-gray-900"
                          style={{ ["--tw-ring-color" as string]: `${accent}50` }}
                        >
                          {nextUp.employeeId ? (
                            <img
                              src={`/api/directory/photo?userId=${encodeURIComponent(nextUp.employeeId)}&name=${encodeURIComponent(nextUp.employeeName)}&size=240x240`}
                              alt={nextUp.employeeName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div
                              className="h-full w-full flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                            >
                              {getInitials(nextUp.employeeName)}
                            </div>
                          )}
                        </div>
                        {/* Type badge */}
                        {(() => {
                          const Icon = TYPE_CONFIG[nextUp.type]?.icon;
                          return Icon ? (
                            <div
                              className="absolute -bottom-0.5 -right-0.5 h-[16px] w-[16px] rounded-full flex items-center justify-center border-[1.5px] border-white dark:border-gray-900"
                              style={{ backgroundColor: accent }}
                            >
                              <Icon className="h-2 w-2 text-white" />
                            </div>
                          ) : null;
                        })()}
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-gray-900 dark:text-gray-50 leading-tight truncate">
                      {nextUp.employeeName}
                    </p>
                    <p className="text-[10.5px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
                      {nextUp.type === "birthday" ? "Birthday" : "Anniversary"}
                      {" · "}
                      {new Date(nextUp.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
                {/* "in X days" pill */}
                <span className="shrink-0 text-[10px] font-semibold bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full whitespace-nowrap">
                  in {nextUp.daysAway} day{nextUp.daysAway !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* List */}
          <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
            <AnimatePresence mode="popLayout">
              {visible.map((item) => (
                <CelebrationRow key={item.id} item={item} />
              ))}
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
        </>
      )}
    </div>
  );
}
