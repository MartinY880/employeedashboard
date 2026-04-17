// ProConnect — Employee Highlight Widget
// Displays the current highlighted employee above the FeedPanel

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Sparkles } from "lucide-react";
import { PersonLightbox } from "@/components/shared/ProfileDialog";
import { type DirectoryNode } from "@/hooks/useDirectory";

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
  const [selectedUser, setSelectedUser] = useState<DirectoryNode | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    fetch("/api/highlights")
      .then((r) => r.json())
      .then((data: Highlight[]) => {
        if (data.length > 0) setHighlight(data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePersonClick = useCallback(async (employeeId: string | null) => {
    if (!employeeId) return;
    try {
      const res = await fetch(`/api/directory?userId=${encodeURIComponent(employeeId)}`);
      const data = await res.json();
      if (data?.user) {
        setSelectedUser(data.user);
        setLightboxOpen(true);
      }
    } catch { /* silently fail */ }
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-amber-400">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="p-4 space-y-2">
          <div className="h-4 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
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
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border-b border-amber-100 dark:border-amber-900 border-t-[3px] border-t-amber-400 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 tracking-wide uppercase">
            Employee Highlight
          </h3>
          <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-auto" />
        </div>

        {/* Content */}
        <div className="p-4 flex items-start gap-3">
          {/* Avatar — clickable */}
          <button
            type="button"
            onClick={() => handlePersonClick(highlight.employeeId)}
            className="flex-shrink-0 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={highlight.employeeName}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-200 hover:opacity-80 transition-opacity"
            />
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => handlePersonClick(highlight.employeeId)}
              className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight hover:text-brand-blue transition-colors cursor-pointer focus:outline-none"
            >
              {highlight.employeeName}
            </button>
            {(highlight.jobTitle || highlight.department) && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                {highlight.jobTitle}{highlight.department ? ` · ${highlight.department}` : ""}
              </p>
            )}
            <p className="text-xs font-semibold text-amber-600 mt-0.5">
              ⭐ {highlight.title}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
              {highlight.subtitle}
            </p>
          </div>
        </div>
      </motion.div>

      <PersonLightbox
        user={selectedUser}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </AnimatePresence>
  );
}
