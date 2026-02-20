// ProConnect — FeedPanel Widget
// Tabbed container for right column: "CHAT & KUDOS" | "ALERTS"

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, AlertTriangle } from "lucide-react";
import { KudosFeed } from "./KudosFeed";
import { AlertsFeed } from "./AlertsFeed";
import { useSounds } from "@/components/shared/SoundProvider";

const tabs = [
  { id: "kudos" as const, label: "Chat & Kudos", icon: MessageCircle },
  { id: "alerts" as const, label: "Alerts", icon: AlertTriangle },
];

export function FeedPanel() {
  const [activeTab, setActiveTab] = useState<"kudos" | "alerts">("kudos");
  const { playClick, playNotify } = useSounds();

  // Track new alerts for notification badge
  const [newAlertCount, setNewAlertCount] = useState(0);
  const knownAlertCountRef = useRef<number | null>(null);

  // Load the last-seen alert count from localStorage so badge persists across navigations
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
        // First load ever — set baseline, no notification
        knownAlertCountRef.current = currentCount;
        localStorage.setItem("proconnect-seen-alert-count", String(currentCount));
      } else if (currentCount > knownAlertCountRef.current) {
        // New alerts added since last seen
        const diff = currentCount - knownAlertCountRef.current;
        setNewAlertCount((prev) => prev + diff);
        knownAlertCountRef.current = currentCount;
        // Don't update localStorage yet — only when the user views the tab
        playNotify();
      } else if (currentCount < knownAlertCountRef.current) {
        // Count decreased (deleted) — update baseline
        knownAlertCountRef.current = currentCount;
        localStorage.setItem("proconnect-seen-alert-count", String(currentCount));
      }
    } catch {
      // Silently ignore fetch errors
    }
  }, [playNotify]);

  useEffect(() => {
    checkForNewAlerts();
    // Poll every 15 seconds for new alerts
    const interval = setInterval(checkForNewAlerts, 15000);
    return () => clearInterval(interval);
  }, [checkForNewAlerts]);

  const handleTabSwitch = (tabId: "kudos" | "alerts") => {
    if (tabId !== activeTab) {
      playClick();
      setActiveTab(tabId);
      // Clear notification when switching to alerts tab & persist as "seen"
      if (tabId === "alerts") {
        setNewAlertCount(0);
        if (knownAlertCountRef.current !== null) {
          localStorage.setItem("proconnect-seen-alert-count", String(knownAlertCountRef.current));
        }
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const showBadge = tab.id === "alerts" && newAlertCount > 0 && !isActive;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                isActive
                  ? "text-brand-blue"
                  : "text-brand-grey hover:text-brand-blue/70"
              }`}
            >
              {showBadge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm"
                >
                  {newAlertCount > 9 ? "9+" : newAlertCount}
                </motion.span>
              )}
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="feed-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand-blue"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
        <div className="bg-brand-bg/50 min-h-[360px] sm:min-h-[480px] max-h-[480px] sm:max-h-[560px] overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {activeTab === "kudos" ? <KudosFeed /> : <AlertsFeed />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
