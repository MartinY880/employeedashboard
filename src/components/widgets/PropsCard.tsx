// ProConnect — Props Card Widget (Gamified)
// Award-style praise card: badge ribbon, author → recipient, message, reactions
// Each praise feels like a collectible achievement

"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSounds } from "@/components/shared/SoundProvider";
import { motion } from "framer-motion";

/* ─── Badge Definitions ────────────────────────────────── */

export const PRAISE_BADGES = [
  {
    key: "mvp",
    label: "MVP",
    emoji: "🏆",
    emojiScale: "scale-110",
    gradient: "from-amber-400 to-yellow-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800",
    glow: "shadow-amber-200/40",
    desc: "Most Valuable Player",
  },
  {
    key: "rockstar",
    label: "Rockstar",
    emoji: "🎸",
    emojiScale: "scale-110",
    gradient: "from-purple-500 to-pink-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800",
    glow: "shadow-purple-200/40",
    desc: "Absolute legend",
  },
  {
    key: "brainiac",
    label: "Brainiac",
    emoji: "🧠",
    emojiScale: "scale-110",
    gradient: "from-blue-500 to-cyan-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800",
    glow: "shadow-blue-200/40",
    desc: "Big brain energy",
  },
  {
    key: "heart",
    label: "Big Heart",
    emoji: "💖",
    emojiScale: "scale-100",
    gradient: "from-pink-400 to-rose-500",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    border: "border-pink-200 dark:border-pink-800",
    glow: "shadow-pink-200/40",
    desc: "Goes above & beyond",
  },
  {
    key: "fire",
    label: "On Fire",
    emoji: "🔥",
    emojiScale: "scale-100",
    gradient: "from-orange-500 to-red-500",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    border: "border-orange-200 dark:border-orange-800",
    glow: "shadow-orange-200/40",
    desc: "Unstoppable streak",
  },
  {
    key: "teamplayer",
    label: "Team Player",
    emoji: "🤝",
    emojiScale: "scale-100",
    gradient: "from-emerald-400 to-teal-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800",
    glow: "shadow-emerald-200/40",
    desc: "Strongest together",
  },
] as const;

export type PraiseBadgeKey = (typeof PRAISE_BADGES)[number]["key"];

export function getBadge(key: string | undefined) {
  return PRAISE_BADGES.find((b) => b.key === key) || PRAISE_BADGES[0];
}

/* ─── Reactions ────────────────────────────────────────── */

const REACTIONS = [
  { key: "highfive", emoji: "🙌", label: "High Five", bg: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40", activeBg: "bg-amber-200 dark:bg-amber-800", ring: "ring-amber-300 dark:ring-amber-700" },
  { key: "uplift", emoji: "🚀", label: "Uplift", bg: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40", activeBg: "bg-blue-200 dark:bg-blue-800", ring: "ring-blue-300 dark:ring-blue-700" },
  { key: "bomb", emoji: "💣", label: "Bomb", bg: "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40", activeBg: "bg-red-200 dark:bg-red-800", ring: "ring-red-300 dark:ring-red-700" },
] as const;

type ReactionKey = (typeof REACTIONS)[number]["key"];

/* ─── Props Interface ──────────────────────────────────── */

interface PropsCardProps {
  id?: string;
  authorName: string;
  authorInitials: string;
  authorPhotoUrl?: string;
  recipientName: string;
  message: string;
  likes: number;
  reactions?: Record<ReactionKey, number>;
  myReactions?: ReactionKey[];
  onReact?: (reaction: ReactionKey) => Promise<void>;
  createdAt: string;
  badge?: string;
}

/* ─── Component ────────────────────────────────────────── */

export function PropsCard({
  authorName,
  authorInitials,
  authorPhotoUrl,
  recipientName,
  message,
  likes,
  reactions: reactionCounts,
  myReactions: currentUserReactions,
  onReact,
  createdAt,
  badge: badgeKey,
}: PropsCardProps) {
  const { playPop } = useSounds();
  const badge = getBadge(badgeKey);

  const reactions: Record<ReactionKey, number> = reactionCounts || {
    highfive: likes,
    uplift: 0,
    bomb: 0,
  };
  const myReactions = new Set<ReactionKey>(currentUserReactions || []);
  const [poppedReaction, setPoppedReaction] = useState<ReactionKey | null>(null);
  const [isToggling, setIsToggling] = useState<ReactionKey | null>(null);
  const timeAgo = getRelativeTime(createdAt);
  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  const handleReaction = async (key: ReactionKey) => {
    if (!onReact || isToggling === key) return;

    setIsToggling(key);
    try {
      await onReact(key);
    } finally {
      setIsToggling(null);
    }

    playPop();
    setPoppedReaction(key);
    setTimeout(() => setPoppedReaction(null), 400);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`relative overflow-hidden rounded-xl border ${badge.border} shadow-sm hover:shadow-md ${badge.glow} transition-all duration-300`}
    >
      {/* Badge Header Ribbon */}
      <div className={`bg-gradient-to-r ${badge.gradient} px-3.5 py-2 flex items-center gap-2`}>
        <span className="h-5 w-5 inline-flex items-center justify-center">
          <span className={`text-lg leading-none drop-shadow-sm ${badge.emojiScale}`}>{badge.emoji}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-[11px] uppercase tracking-wider leading-none">
            {badge.label}
          </div>
          <div className="text-white/70 text-[9px] leading-tight mt-0.5">{badge.desc}</div>
        </div>
        {totalReactions > 0 && (
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
            <span className="text-white text-[10px] font-bold tabular-nums">{totalReactions}</span>
            <span className="text-white/80 text-[9px]">✦</span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className={`${badge.bg} p-3.5`}>
        {/* Author → Recipient */}
        <div className="flex items-center gap-2 mb-2.5">
          <Avatar className="h-7 w-7 shrink-0 ring-2 ring-white shadow-sm">
            {authorPhotoUrl && (
              <AvatarImage src={authorPhotoUrl} alt={authorName} />
            )}
            <AvatarFallback className="bg-brand-blue/10 text-brand-blue text-[9px] font-bold">
              {authorInitials}
            </AvatarFallback>
          </Avatar>
          <div className="text-xs min-w-0 flex-1">
            <span className="font-bold text-gray-800 dark:text-gray-200">{authorName}</span>
            <span className="text-gray-400 dark:text-gray-500 mx-1">→</span>
            <span className="font-bold text-brand-blue">@{recipientName}</span>
          </div>
          <span className="text-[10px] text-gray-400 shrink-0">{timeAgo}</span>
        </div>

        {/* Message */}
        <p className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed mb-3 pl-9 italic">
          &ldquo;{message}&rdquo;
        </p>

        {/* Reactions Row */}
        <div className="flex items-center gap-1.5 pl-9">
          {REACTIONS.map((r) => {
            const isActive = myReactions.has(r.key);
            const count = reactions[r.key];
            const isPopping = poppedReaction === r.key;
            return (
              <motion.button
                key={r.key}
                onClick={() => void handleReaction(r.key)}
                animate={isPopping ? { scale: [1, 1.35, 1] } : {}}
                transition={{ duration: 0.3 }}
                disabled={isToggling === r.key}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? `${r.activeBg} ring-1 ${r.ring} shadow-sm`
                    : `bg-white/80 dark:bg-gray-800/80 ${r.bg}`
                }`}
                title={r.label}
              >
                <span className="text-sm leading-none">{r.emoji}</span>
                {count > 0 && (
                  <span className={`tabular-nums text-[11px] ${isActive ? "font-bold" : "text-gray-500 dark:text-gray-400"}`}>
                    {count}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Helper ───────────────────────────────────────────── */

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
