// ProConnect — FeedPanel Widget
// Tabbed container for right column: "PROPS" | "TROPHIES"

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Trophy } from "lucide-react";
import { KudosFeed } from "./KudosFeed";
import { TrophyCase } from "./TrophyCase";
import { useSounds } from "@/components/shared/SoundProvider";

type TabId = "kudos" | "trophies";

const tabs = [
  { id: "kudos" as TabId, label: "Props", icon: Zap },
  { id: "trophies" as TabId, label: "Trophies", icon: Trophy },
];

export function FeedPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("kudos");
  const { playClick } = useSounds();

  const handleTabSwitch = (tabId: TabId) => {
    if (tabId !== activeTab) {
      playClick();
      setActiveTab(tabId);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
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
        <div className="bg-brand-bg/50 min-h-[400px] sm:min-h-[530px] max-h-[530px] sm:max-h-[620px] overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="p-4"
          >
            {activeTab === "kudos" ? <KudosFeed /> : <TrophyCase />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
