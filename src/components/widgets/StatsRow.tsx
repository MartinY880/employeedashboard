// ProConnect — StatsRow Widget
// Header banner + dynamic pillar card grid — fetches from /api/pillars (admin-editable)

"use client";

import { useState, useEffect } from "react";
import { PillarCard } from "./PillarCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import type { PillarData, PillarHeader } from "@/lib/pillar-icons";

const DEFAULT_PILLARS: PillarData[] = [
  { id: "p1", icon: "Shield", title: "Integrity", message: "We act with honesty and transparency in everything we do." },
  { id: "p2", icon: "Target", title: "Accountability", message: "We own our results and deliver on our commitments." },
  { id: "p3", icon: "Users", title: "Teamwork", message: "We collaborate and support each other to achieve more." },
  { id: "p4", icon: "Lightbulb", title: "Innovation", message: "We embrace new ideas and continuously improve." },
  { id: "p5", icon: "HeartHandshake", title: "Service", message: "We put our clients and community at the center of our work." },
  { id: "p6", icon: "TrendingUp", title: "Excellence", message: "We strive for the highest standard in everything we do." },
];

const DEFAULT_HEADER: PillarHeader = {
  title: "OUR COMPANY PILLARS",
  subtitle: "The core values that drive everything we do at MortgagePros",
  maxWidth: 1400,
};

export function StatsRow() {
  const [pillars, setPillars] = useState<PillarData[]>(DEFAULT_PILLARS);
  const [header, setHeader] = useState<PillarHeader>(DEFAULT_HEADER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pillars")
      .then((r) => r.json())
      .then((data) => {
        // New format: { pillars, header }
        if (data && data.pillars && Array.isArray(data.pillars)) {
          setPillars(data.pillars);
          if (data.header) setHeader(data.header);
        } else if (Array.isArray(data) && data.length > 0) {
          // Legacy format: plain array
          setPillars(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-4">
        <Skeleton className="h-[52px] rounded-xl bg-brand-blue/10" />
        <div
          className="grid gap-4 mx-auto"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            maxWidth: "1400px",
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Skeleton className="h-[140px] rounded-xl bg-brand-blue/10" />
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-4" style={{ maxWidth: `${header.maxWidth ?? 1100}px` }}>
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="bg-gradient-to-br from-brand-blue to-[#084f96] text-white rounded-xl px-6 py-3.5 text-center shadow-lg relative overflow-hidden"
      >
        {/* Decorative circles */}
        <div className="absolute -top-8 -left-8 w-28 h-28 bg-white/[0.05] rounded-full" />
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/[0.04] rounded-full" />

        <h2
          className="font-bold uppercase tracking-[0.14em] relative z-10"
          style={{ fontSize: `${header.bannerTitleSize ?? 14}px` }}
        >
          {header.title}
        </h2>
        <p
          className="font-medium opacity-70 mt-0.5 relative z-10"
          style={{ fontSize: `${header.bannerSubtitleSize ?? 11}px` }}
        >
          {header.subtitle}
        </p>
      </motion.div>

      {/* Pillar Cards — 2-col on mobile, auto-fit on sm+ */}
      <style>{`
        @media (min-width: 640px) {
          .pillar-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)) !important;
          }
        }
      `}</style>
      <div className="pillar-grid grid grid-cols-2 gap-4 mx-auto">
        {pillars.map((pillar, i) => {
          const isLast = i === pillars.length - 1;
          const isOddCount = pillars.length % 2 !== 0;
          return (
            <div
              key={pillar.id}
              className={isLast && isOddCount ? "col-span-2 sm:col-span-1" : ""}
            >
              <PillarCard
                iconName={pillar.icon}
                title={pillar.title}
                message={pillar.message}
                index={i}
                titleSize={header.cardTitleSize}
                messageSize={header.cardMessageSize}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
