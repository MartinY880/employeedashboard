// ProConnect — Closers Table Banner Widget
// Horizontal scrolling awards banner with glassmorphism card style
// Pulls Microsoft profile photos via the directory photo proxy

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

interface CloserAward {
  id: string;
  employeeId: string | null;
  employeeName: string;
  award: string;
  color: string;
  awardFontSize: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ClosersTableBanner() {
  const [awards, setAwards] = useState<CloserAward[]>([]);

  useEffect(() => {
    fetch("/api/closers-table")
      .then((r) => r.json())
      .then((d) => {
        if (d?.awards?.length) setAwards(d.awards);
      })
      .catch(() => {});
  }, []);

  if (!awards.length) return null;

  return (
    <section className="mb-5">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header — matches Quick Links / Important Dates / Weather style */}
        <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-center gap-2">
          <Trophy className="h-4 w-4 text-brand-blue" />
          <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
            Closers Table
          </h3>
          <Trophy className="h-4 w-4 text-brand-blue" />
        </div>

        {/* Cards — centered, wraps if needed */}
        <div className="flex gap-3 justify-center flex-wrap p-4 items-stretch">
          {awards.map((award, i) => {
            const c = award.color || "#f59e0b";
            const fontSize = award.awardFontSize || 10;
            return (
              <motion.div
                key={award.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="w-[130px]"
              >
                {/* Glassmorphism card */}
                <div className="relative rounded-xl overflow-hidden backdrop-blur-md bg-gray-50 dark:bg-white/[0.07] border border-gray-200 dark:border-white/10 shadow-md p-3 flex flex-col items-center text-center group hover:bg-gray-100/80 dark:hover:bg-white/10 transition-colors h-full"
                  style={{ boxShadow: `0 4px 14px ${c}20` }}
                >
                  {/* Accent gradient at top */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                    style={{ background: c }}
                  />
                  {/* Subtle shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-white/10 dark:from-white/5 dark:to-white/[0.02] pointer-events-none" />

                  {/* Square photo */}
                  <div className="relative mb-2 mt-1">
                    <div
                      className="h-20 w-20 rounded-full overflow-hidden shadow-md"
                      style={{ outline: `2px solid ${c}50`, outlineOffset: "1px" }}
                    >
                      {award.employeeId ? (
                        <img
                          src={`/api/directory/photo?userId=${encodeURIComponent(award.employeeId)}&name=${encodeURIComponent(award.employeeName)}&size=240x240`}
                          alt={award.employeeName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full flex items-center justify-center text-sm font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${c}, ${c}cc)` }}
                        >
                          {getInitials(award.employeeName)}
                        </div>
                      )}
                    </div>
                    {/* Trophy badge */}
                    <div
                      className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: c }}
                    >
                      <Trophy className="h-3 w-3 text-white" />
                    </div>
                  </div>

                  {/* Name */}
                  <p className="relative text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight truncate w-full">
                    {award.employeeName}
                  </p>

                  {/* Award */}
                  <p
                    className="relative leading-tight mt-0.5 line-clamp-2 w-full font-medium"
                    style={{ color: c, fontSize: `${fontSize}px` }}
                  >
                    {award.award}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
