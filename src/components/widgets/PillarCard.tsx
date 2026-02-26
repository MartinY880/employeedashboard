// ProConnect — PillarCard Widget
// Pillar box: brand-blue bg, title + message, hover glow + lift + pop sound
// Reuses StatCard styling with text-based layout instead of numeric counter

"use client";

import { motion } from "framer-motion";
import { useSounds } from "@/components/shared/SoundProvider";
import { ICON_MAP, type PillarIconName } from "@/lib/pillar-icons";
import { renderQuickLinkIconPreview } from "@/components/widgets/QuickLinksBar";

interface PillarCardProps {
  iconName: string;
  title: string;
  message: string;
  index?: number;
  titleSize?: number;
  messageSize?: number;
}

export function PillarCard({ iconName, title, message, index = 0, titleSize = 14, messageSize = 11 }: PillarCardProps) {
  const { playPop } = useSounds();
  const LegacyIcon = ICON_MAP[iconName as PillarIconName];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.4,
        delay: 0.1 + index * 0.08,
        ease: "easeOut",
      }}
      whileHover={{
        y: -4,
        boxShadow: "0 12px 28px rgba(6, 66, 127, 0.25)",
        transition: { duration: 0.2 },
      }}
      onHoverStart={playPop}
      className="relative bg-gradient-to-br from-brand-blue to-[#084f96] text-white px-3 py-5 min-h-[170px] h-full rounded-xl shadow-lg flex flex-col justify-start items-center text-center cursor-default overflow-hidden group"
    >
      {/* Decorative circles */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/[0.06] rounded-full transition-transform duration-500 group-hover:scale-125" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/[0.04] rounded-full" />

      {/* Icon */}
      {LegacyIcon ? (
        <LegacyIcon className="w-5 h-5 opacity-60 mb-2 relative z-10 shrink-0" />
      ) : (
        <span className="opacity-60 mb-2 relative z-10 shrink-0">
          {renderQuickLinkIconPreview(iconName, "w-5 h-5")}
        </span>
      )}

      {/* Title */}
      <div
        className="font-bold uppercase tracking-[0.10em] relative z-10 leading-tight shrink-0 whitespace-pre-line"
        style={{ fontSize: `${titleSize}px` }}
      >
        {title}
      </div>

      {/* Divider */}
      <div className="w-8 h-[2px] bg-white/30 rounded-full mt-2 mb-2 relative z-10 shrink-0" />

      {/* Message */}
      <div
        className="font-medium opacity-80 leading-relaxed relative z-10 whitespace-pre-line"
        style={{ fontSize: `${messageSize}px` }}
      >
        {message}
      </div>
    </motion.div>
  );
}
