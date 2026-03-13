// ProConnect — StatsRow Widget
// Header banner + dynamic pillar card grid — fetches from /api/pillars (admin-editable)
// Supports three templates: v1 (card grid), v2 (5×3 table grid), v3 (stacked cards)

"use client";

import { useState, useEffect } from "react";
import { PillarCard } from "./PillarCard";
import { PillarGridV2 } from "./PillarGridV2";
import { PillarGridV3 } from "./PillarGridV3";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import type { PillarData, PillarHeader, PillarV2Data } from "@/lib/pillar-icons";
import { DEFAULT_PILLAR_V2 } from "@/lib/pillar-icons";

// Google Fonts that may be used in the banner rich text
const GOOGLE_FONT_MAP: Record<string, string> = {
  Montserrat: "Montserrat:wght@400;700;900",
  "Playfair Display": "Playfair+Display:wght@400;700;900",
  Oswald: "Oswald:wght@400;500;700",
  Raleway: "Raleway:wght@400;700;900",
  Poppins: "Poppins:wght@400;600;700;900",
  Roboto: "Roboto:wght@400;500;700;900",
  Lato: "Lato:wght@400;700;900",
  "Open Sans": "Open+Sans:wght@400;600;700",
  "Bebas Neue": "Bebas+Neue",
  Anton: "Anton",
};
const loadedFonts = new Set<string>();
function ensureGoogleFonts(html: string) {
  if (typeof document === "undefined") return;
  for (const [name, spec] of Object.entries(GOOGLE_FONT_MAP)) {
    if (html.includes(name) && !loadedFonts.has(spec)) {
      loadedFonts.add(spec);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
      document.head.appendChild(link);
    }
  }
}

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
  const [v2Data, setV2Data] = useState<PillarV2Data>(DEFAULT_PILLAR_V2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pillars")
      .then((r) => r.json())
      .then((data) => {
        // New format: { pillars, header, v2 }
        if (data && data.pillars && Array.isArray(data.pillars)) {
          setPillars(data.pillars);
          if (data.header) setHeader(data.header);
          if (data.v2) setV2Data(data.v2);
        } else if (Array.isArray(data) && data.length > 0) {
          // Legacy format: plain array
          setPillars(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load any Google Fonts referenced in the rich-text title/subtitle
  useEffect(() => {
    ensureGoogleFonts(header.title + header.subtitle);
  }, [header.title, header.subtitle]);

  const template = header.template ?? "v1";

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-4">
        <Skeleton className="h-[52px] rounded-xl bg-brand-blue/10" />
        <div
          className="grid gap-4 mx-auto"
          style={{
            gridTemplateColumns: (template === "v2" || template === "v3") ? "repeat(3, 1fr)" : "repeat(auto-fit, minmax(150px, 1fr))",
            maxWidth: "1400px",
          }}
        >
          {Array.from({ length: (template === "v2" || template === "v3") ? 15 : 6 }).map((_, i) => (
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
        className="rounded-xl shadow-lg relative overflow-hidden"
      >
        {/* Banner background — default gradient, overridden when custom color set */}
        {!header.bannerGradientColor && !header.subtitleGradientColor && (
          <div className="absolute inset-0 bg-gradient-to-br from-brand-blue to-[#084f96]" />
        )}

        {/* Decorative circles */}
        <div className="absolute -top-8 -left-8 w-28 h-28 bg-white/[0.05] rounded-full" />
        <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-white/[0.04] rounded-full" />

        {/* Title row */}
        <div className="relative px-6 pt-3.5 pb-1 text-center">
          {header.bannerGradientColor && (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to right, transparent, ${header.bannerGradientColor}, transparent)` }}
            />
          )}
          {!header.bannerGradientColor && header.subtitleGradientColor && (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue to-[#084f96]" />
          )}
          {header.title.includes("<") ? (
            <div
              className="banner-rich-text relative z-10 text-white"
              dangerouslySetInnerHTML={{ __html: header.title }}
            />
          ) : (
            <h2
              className="font-bold uppercase tracking-[0.14em] relative z-10 text-white"
              style={{ fontSize: `${header.bannerTitleSize ?? 14}px` }}
            >
              {header.title}
            </h2>
          )}
        </div>

        {/* Subtitle row */}
        <div className="relative px-6 py-2.5 text-center flex items-center justify-center">
          {header.subtitleGradientColor && (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(to right, transparent, ${header.subtitleGradientColor}, transparent)` }}
            />
          )}
          {!header.subtitleGradientColor && header.bannerGradientColor && (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-blue to-[#084f96]" />
          )}
          {header.subtitle.includes("<") ? (
            <div
              className="banner-rich-text relative z-10 text-white"
              dangerouslySetInnerHTML={{ __html: header.subtitle }}
            />
          ) : (
            <p
              className="font-medium relative z-10 whitespace-pre-line text-white"
              style={{ fontSize: `${header.bannerSubtitleSize ?? 11}px` }}
            >
              {header.subtitle}
            </p>
          )}
        </div>
      </motion.div>

      {/* Template switch: v1 = card grid, v2 = 5×3 table grid, v3 = stacked cards */}
      {template === "v3" ? (
        <PillarGridV3
          data={v2Data}
          cardTitleSize={header.cardTitleSize}
          cardMessageSize={header.cardMessageSize}
          iconSize={header.iconSize}
          col1TitleColor={header.col1TitleColor}
          col2TitleColor={header.col2TitleColor}
          col3TitleColor={header.col3TitleColor}
          cellTitleColor={header.cellTitleColor}
          cardBgOpacity={header.cardBgOpacity}
        />
      ) : template === "v2" ? (
        <PillarGridV2
          data={v2Data}
          cardTitleSize={header.cardTitleSize}
          cardMessageSize={header.cardMessageSize}
          iconSize={header.iconSize}
          col1TitleColor={header.col1TitleColor}
          col2TitleColor={header.col2TitleColor}
          col3TitleColor={header.col3TitleColor}
          cellTitleColor={header.cellTitleColor}
          cardBgOpacity={header.cardBgOpacity}
        />
      ) : (
        <>
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
                    iconSize={header.iconSize}
                    titleColor={header.cellTitleColor}
                    cardBgOpacity={header.cardBgOpacity}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
