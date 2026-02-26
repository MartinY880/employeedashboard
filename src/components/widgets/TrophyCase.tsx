// ProConnect — Trophy Case Widget
// Collectible praise gallery showing awards received, badge stats, leaderboard

"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { PRAISE_BADGES, getBadge } from "./KudosCard";
import { useKudos } from "@/hooks/useKudos";
import { Skeleton } from "@/components/ui/skeleton";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TrophyCase() {
  const { kudos, isLoading, currentUserId } = useKudos();

  // Aggregate stats from all kudos
  const stats = useMemo(() => {
    // Count badges by type
    const badgeCounts: Record<string, number> = {};
    PRAISE_BADGES.forEach((b) => (badgeCounts[b.key] = 0));

    // Count awards per person (leaderboard)
    const peopleCounts: Record<string, { name: string; count: number; badges: Set<string> }> = {};

    kudos.forEach((k) => {
      const badge = k.badge || "mvp";
      badgeCounts[badge] = (badgeCounts[badge] || 0) + 1;

      const recipName = k.recipient?.displayName || "Unknown";
      if (!peopleCounts[recipName]) {
        peopleCounts[recipName] = { name: recipName, count: 0, badges: new Set() };
      }
      peopleCounts[recipName].count++;
      peopleCounts[recipName].badges.add(badge);
    });

    // Top recipients
    const leaderboard = Object.values(peopleCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Count how many the current user received (dev user = "John Doe")
    const myReceivedCount = currentUserId
      ? kudos.filter((k) => k.recipientId === currentUserId).length
      : 0;

    const myGivenCount = currentUserId
      ? kudos.filter((k) => k.authorId === currentUserId).length
      : 0;

    return {
      badgeCounts,
      leaderboard,
      totalAwarded: kudos.length,
      myReceivedCount,
      myGivenCount,
    };
  }, [kudos, currentUserId]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid grid-cols-2 gap-2.5"
      >
        <div className="bg-brand-blue rounded-xl p-3.5 text-center text-white shadow-md">
          <div className="text-2xl font-black tabular-nums">{stats.myGivenCount}</div>
          <div className="text-[10px] font-medium text-white/80 uppercase tracking-wider mt-0.5">
            Awards Given
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-3.5 text-center border-2 border-brand-blue shadow-md">
          <div className="text-2xl font-black tabular-nums text-brand-blue">{stats.myReceivedCount}</div>
          <div className="text-[10px] font-medium text-brand-grey uppercase tracking-wider mt-0.5">
            Awards Received
          </div>
        </div>
      </motion.div>

      {/* Badge Collection Grid */}
      <div>
        <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Badge Collection
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {PRAISE_BADGES.map((b, i) => {
            const count = stats.badgeCounts[b.key] || 0;
            const isUnlocked = count > 0;
            return (
              <motion.div
                key={b.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative rounded-lg p-2.5 text-center transition-all ${
                  isUnlocked
                    ? `${b.bg} ${b.border} border shadow-sm`
                    : "bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 opacity-50"
                }`}
              >
                <span className={`text-xl block mb-0.5 ${isUnlocked ? "" : "grayscale"}`}>
                  {b.emoji}
                </span>
                <div className={`text-[9px] font-bold uppercase leading-tight ${isUnlocked ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}`}>
                  {b.label}
                </div>
                {isUnlocked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-gradient-to-r ${b.gradient} text-white text-[9px] font-black shadow-sm`}
                  >
                    {count}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Leaderboard */}
      {stats.leaderboard.length > 0 && (
        <div>
          <h4 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Most Awarded
          </h4>
          <div className="space-y-1.5">
            {stats.leaderboard.map((person, i) => {
              const medals = ["🥇", "🥈", "🥉", "4.", "5."];
              return (
                <motion.div
                  key={person.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${
                    i === 0
                      ? "bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200"
                      : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700"
                  }`}
                >
                  <span className={`text-sm font-bold ${i < 3 ? "" : "text-gray-400 dark:text-gray-500 text-xs w-4 text-center"}`}>
                    {medals[i]}
                  </span>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    i === 0
                      ? "bg-amber-200 text-amber-800"
                      : "bg-brand-blue/10 text-brand-blue"
                  }`}>
                    {getInitials(person.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{person.name}</div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {Array.from(person.badges).slice(0, 4).map((bk) => (
                        <span key={bk} className="text-[10px]">{getBadge(bk).emoji}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-brand-blue tabular-nums">{person.count}</div>
                    <div className="text-[9px] text-gray-400 dark:text-gray-500">awards</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
