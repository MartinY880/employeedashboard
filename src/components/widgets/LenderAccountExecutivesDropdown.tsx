// ProConnect — LenderAccountExecutivesDropdown Widget
// Thin lender contacts bar; dropdown overlays content below

"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, ChevronDown, Users } from "lucide-react";
import { LenderAccountExecutivesFeed } from "./LenderAccountExecutivesFeed";
import { useSounds } from "@/components/shared/SoundProvider";

export function LenderAccountExecutivesDropdown() {
  const { playClick } = useSounds();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToggle() {
    playClick();
    setIsOpen((prev) => !prev);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        className={`w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-3 py-2 gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
          isOpen ? "ring-2 ring-brand-blue/30" : ""
        }`}
      >
        <Building2 className="w-4 h-4 text-brand-grey/60 shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex-1 text-left">AE Contacts</span>
        <Users className="w-3.5 h-3.5 text-brand-grey/50" />

        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-brand-grey/50" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -6, scaleY: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: "top center" }}
            className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden"
          >
            <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-brand-blue" />
              <span className="text-xs font-bold text-brand-blue uppercase tracking-wider">Account Executive Contacts</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-3 scrollbar-thin">
              <LenderAccountExecutivesFeed />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
