// ProConnect — Employee Highlight Widget
// Displays the current highlighted employee above the FeedPanel

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles } from "lucide-react";

interface Highlight {
  id: string;
  employeeId: string | null;
  employeeName: string;
  jobTitle: string | null;
  department: string | null;
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  active: boolean;
  startDate: string;
}

export function EmployeeHighlight() {
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/highlights")
      .then((r) => r.json())
      .then((data: Highlight[]) => {
        // Show the most recent active highlight
        if (data.length > 0) setHighlight(data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 border-t-[3px] border-t-amber-400">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!highlight) return null;

  // Build photo URL: use avatarUrl if available, otherwise generate from directory photo proxy
  const photoSrc = highlight.avatarUrl
    || `/api/directory/photo?userId=${encodeURIComponent(highlight.employeeId || "none")}&name=${encodeURIComponent(highlight.employeeName)}&size=120x120`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100 border-t-[3px] border-t-amber-400 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          <h3 className="text-sm font-bold text-amber-700 tracking-wide uppercase">
            Employee Highlight
          </h3>
          <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-auto" />
        </div>

        {/* Content */}
        <div className="p-4 flex items-start gap-3">
          {/* Avatar — always use directory photo */}
          <div className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={highlight.employeeName}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-200"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 leading-tight">
              {highlight.employeeName}
            </h4>
            {(highlight.jobTitle || highlight.department) && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                {highlight.jobTitle}{highlight.department ? ` · ${highlight.department}` : ""}
              </p>
            )}
            <p className="text-xs font-semibold text-amber-600 mt-0.5">
              ⭐ {highlight.title}
            </p>
            <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-3">
              {highlight.subtitle}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
