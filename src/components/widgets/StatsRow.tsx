// ProConnect — StatsRow Widget
// 6-column grid of pillar cards — fetches from /api/pillars (admin-editable)

"use client";

import { useState, useEffect } from "react";
import { PillarCard } from "./PillarCard";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import type { PillarData } from "@/lib/pillar-icons";

const DEFAULT_PILLARS: PillarData[] = [
  { id: "p1", icon: "Shield", title: "Integrity", message: "We act with honesty and transparency in everything we do." },
  { id: "p2", icon: "Target", title: "Accountability", message: "We own our results and deliver on our commitments." },
  { id: "p3", icon: "Users", title: "Teamwork", message: "We collaborate and support each other to achieve more." },
  { id: "p4", icon: "Lightbulb", title: "Innovation", message: "We embrace new ideas and continuously improve." },
  { id: "p5", icon: "HeartHandshake", title: "Service", message: "We put our clients and community at the center of our work." },
  { id: "p6", icon: "TrendingUp", title: "Excellence", message: "We strive for the highest standard in everything we do." },
];

export function StatsRow() {
  const [pillars, setPillars] = useState<PillarData[]>(DEFAULT_PILLARS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pillars")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setPillars(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {pillars.map((pillar, i) => (
        <PillarCard
          key={pillar.id}
          iconName={pillar.icon}
          title={pillar.title}
          message={pillar.message}
          index={i}
        />
      ))}
    </div>
  );
}
