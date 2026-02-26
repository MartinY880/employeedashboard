// ProConnect — AlertsDropdown Widget
// Thin alerts bar with notification badge; dropdown overlays content below

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, ChevronDown } from "lucide-react";
import { AlertsFeed } from "./AlertsFeed";
import { useSounds } from "@/components/shared/SoundProvider";

export function AlertsDropdown() {
  const { playClick, playNotify } = useSounds();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track new alerts for notification badge
  const [newAlertCount, setNewAlertCount] = useState(0);
  const knownAlertCountRef = useRef<number | null>(null);

  // Load the last-seen alert count from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("proconnect-seen-alert-count");
    if (stored !== null) {
      knownAlertCountRef.current = parseInt(stored, 10);
    }
  }, []);

  const checkForNewAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts?count=true");
      const data = await res.json();
      const currentCount = data.count ?? 0;

      if (knownAlertCountRef.current === null) {
        knownAlertCountRef.current = currentCount;
        localStorage.setItem("proconnect-seen-alert-count", String(currentCount));
      } else if (currentCount > knownAlertCountRef.current) {
        const diff = currentCount - knownAlertCountRef.current;
        setNewAlertCount((prev) => prev + diff);
        knownAlertCountRef.current = currentCount;
        playNotify();
      } else if (currentCount < knownAlertCountRef.current) {
        knownAlertCountRef.current = currentCount;
        localStorage.setItem("proconnect-seen-alert-count", String(currentCount));
      }
    } catch {
      // Silently ignore
    }
  }, [playNotify]);

  useEffect(() => {
    checkForNewAlerts();
    const interval = setInterval(checkForNewAlerts, 15000);
    return () => clearInterval(interval);
  }, [checkForNewAlerts]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    playClick();
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      // Mark alerts as seen
      setNewAlertCount(0);
      if (knownAlertCountRef.current !== null) {
        localStorage.setItem("proconnect-seen-alert-count", String(knownAlertCountRef.current));
      }
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger bar */}
      <button
        onClick={handleToggle}
        className={`w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center px-3 py-2 gap-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
          isOpen ? "ring-2 ring-brand-blue/30" : ""
        }`}
      >
        <AlertTriangle className="w-4 h-4 text-brand-grey/60 shrink-0" />
        <span className="text-sm text-gray-700 dark:text-gray-300 font-medium flex-1 text-left">Alerts</span>

        {newAlertCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm"
          >
            {newAlertCount > 9 ? "9+" : newAlertCount}
          </motion.span>
        )}

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-brand-grey/50" />
        </motion.div>
      </button>

      {/* Dropdown overlay */}
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
              <Bell className="w-3.5 h-3.5 text-brand-blue" />
              <span className="text-xs font-bold text-brand-blue uppercase tracking-wider">Notifications</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-3 scrollbar-thin">
              <AlertsFeed />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
