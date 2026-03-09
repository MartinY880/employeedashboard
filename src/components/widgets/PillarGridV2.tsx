// ProConnect — PillarGridV2 Widget
// 5-row × 3-column grid layout for company pillars (v2 template)
// Col 1: icon + title | Col 2: text | Col 3: text

"use client";

import { motion } from "framer-motion";
import { useSounds } from "@/components/shared/SoundProvider";
import { ICON_MAP, type PillarIconName, type PillarV2Data } from "@/lib/pillar-icons";
import { renderQuickLinkIconPreview } from "@/components/widgets/QuickLinksBar";

interface PillarGridV2Props {
  data: PillarV2Data;
  cardTitleSize?: number;
  cardMessageSize?: number;
}

function renderIcon(iconName: string, className = "w-5 h-5") {
  const LegacyIcon = ICON_MAP[iconName as PillarIconName];
  if (LegacyIcon) return <LegacyIcon className={className} />;
  return renderQuickLinkIconPreview(iconName, className);
}

export function PillarGridV2({ data, cardTitleSize = 14, cardMessageSize = 12 }: PillarGridV2Props) {
  const { playPop } = useSounds();

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Column Headers */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {data.columnTitles.map((title, colIdx) => (
            <motion.div
              key={colIdx}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: colIdx * 0.08 }}
              className="bg-gradient-to-br from-brand-blue to-[#084f96] text-white rounded-xl px-4 py-2.5 text-center shadow-md"
            >
              <span
                className="font-bold uppercase tracking-[0.12em]"
                style={{ fontSize: `${cardTitleSize}px` }}
              >
                {title}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Grid Rows */}
        {data.rows.map((row, rowIdx) => (
          <div key={row.id} className="grid grid-cols-3 gap-3 mb-3">
            {/* Column 1: Icon + Title */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.1 + rowIdx * 0.07 }}
              whileHover={{
                y: -3,
                boxShadow: "0 10px 24px rgba(6, 66, 127, 0.2)",
                transition: { duration: 0.2 },
              }}
              onHoverStart={playPop}
              className="relative bg-gradient-to-br from-brand-blue to-[#084f96] text-white px-4 py-4 rounded-xl shadow-lg flex items-center gap-3 cursor-default overflow-hidden group"
            >
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-white/[0.05] rounded-full transition-transform duration-500 group-hover:scale-125" />
              <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/[0.03] rounded-full" />

              <span className="opacity-70 relative z-10 shrink-0">
                {renderIcon(row.col1Icon, "w-5 h-5")}
              </span>
              <span
                className="font-bold uppercase tracking-[0.08em] relative z-10 leading-tight whitespace-pre-line"
                style={{ fontSize: `${cardTitleSize}px` }}
              >
                {row.col1Title}
              </span>
            </motion.div>

            {/* Column 2: Text */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.15 + rowIdx * 0.07 }}
              whileHover={{
                y: -3,
                boxShadow: "0 10px 24px rgba(6, 66, 127, 0.2)",
                transition: { duration: 0.2 },
              }}
              onHoverStart={playPop}
              className="relative bg-gradient-to-br from-brand-blue to-[#084f96] text-white px-4 py-4 rounded-xl shadow-lg flex items-center cursor-default overflow-hidden group"
            >
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-white/[0.05] rounded-full transition-transform duration-500 group-hover:scale-125" />
              <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/[0.03] rounded-full" />

              <span
                className="font-medium opacity-90 leading-relaxed relative z-10 whitespace-pre-line"
                style={{ fontSize: `${cardMessageSize}px` }}
              >
                {row.col2Text}
              </span>
            </motion.div>

            {/* Column 3: Text */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.2 + rowIdx * 0.07 }}
              whileHover={{
                y: -3,
                boxShadow: "0 10px 24px rgba(6, 66, 127, 0.2)",
                transition: { duration: 0.2 },
              }}
              onHoverStart={playPop}
              className="relative bg-gradient-to-br from-brand-blue to-[#084f96] text-white px-4 py-4 rounded-xl shadow-lg flex items-center cursor-default overflow-hidden group"
            >
              <div className="absolute -top-5 -right-5 w-20 h-20 bg-white/[0.05] rounded-full transition-transform duration-500 group-hover:scale-125" />
              <div className="absolute -bottom-3 -left-3 w-14 h-14 bg-white/[0.03] rounded-full" />

              <span
                className="font-medium opacity-90 leading-relaxed relative z-10 whitespace-pre-line"
                style={{ fontSize: `${cardMessageSize}px` }}
              >
                {row.col3Text}
              </span>
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
}
