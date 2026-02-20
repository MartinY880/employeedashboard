// ProConnect — BlueStrip Component
// Brand-blue sub-header: "PROCONNECT" title, date, user greeting

"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface BlueStripProps {
  userName?: string;
}

export function BlueStrip({ userName = "User" }: BlueStripProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const greeting = getGreeting();
  // Use first name only
  const firstName = userName.split(" ")[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="relative overflow-hidden bg-gradient-to-r from-brand-blue to-[#084f96] h-auto min-h-[44px] sm:h-[52px] flex flex-wrap sm:flex-nowrap items-center justify-between px-4 sm:px-6 py-2 sm:py-0 text-white shadow-md gap-y-1"
    >
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
        backgroundSize: "20px 20px",
      }} />

      <div className="relative flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 opacity-70" />
        <span className="text-[15px] font-semibold tracking-[0.15em] uppercase">
          ProConnect
        </span>
      </div>

      <div className="relative flex items-center gap-3 sm:gap-6 text-xs sm:text-sm">
        <span className="opacity-80 hidden sm:inline">{today}</span>
        <div className="w-px h-4 bg-white/30 hidden sm:block" />
        <span className="font-medium">
          {greeting}, <span className="text-blue-200">{firstName}</span>
        </span>
      </div>
    </motion.div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
