// ProConnect — StatCard Widget
// Animated stat card: brand-blue bg, count-up number, label, hover glow + lift

"use client";

import { type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { useSounds } from "@/components/shared/SoundProvider";

interface StatCardProps {
  icon: LucideIcon;
  value: number;
  label: string;
  index?: number;
}

export function StatCard({ icon: Icon, value, label, index = 0 }: StatCardProps) {
  const { playPop } = useSounds();

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
      className="relative bg-gradient-to-br from-brand-blue to-[#084f96] text-white p-6 h-[140px] rounded-xl shadow-lg flex flex-col justify-center items-center text-center cursor-default overflow-hidden group"
    >
      {/* Decorative circle */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/[0.06] rounded-full transition-transform duration-500 group-hover:scale-125" />
      <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-white/[0.04] rounded-full" />

      {/* Icon */}
      <Icon className="absolute top-4 right-4 w-5 h-5 opacity-50 group-hover:opacity-70 transition-opacity" />

      {/* Value */}
      <div className="text-[44px] font-bold leading-none tracking-tight relative z-10">
        <AnimatedCounter value={value} />
      </div>

      {/* Label */}
      <div className="text-xs font-semibold mt-2.5 opacity-80 uppercase tracking-[0.12em] relative z-10">
        {label}
      </div>
    </motion.div>
  );
}
