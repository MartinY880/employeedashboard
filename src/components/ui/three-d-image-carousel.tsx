// Lightswind-inspired 3D Image Carousel
// Interactive rotating carousel with perspective transforms
// Adapted for ProConnect celebration cards

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CarouselItem {
  id: string;
  content: ReactNode;
}

interface ThreeDImageCarouselProps {
  items: CarouselItem[];
  autoRotate?: boolean;
  autoRotateInterval?: number;
  className?: string;
  height?: number;
}

export function ThreeDImageCarousel({
  items,
  autoRotate = true,
  autoRotateInterval = 3000,
  className,
  height = 260,
}: ThreeDImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRotateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = items.length;

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex(((index % count) + count) % count);
    },
    [count]
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate || count <= 1) return;
    autoRotateRef.current = setInterval(next, autoRotateInterval);
    return () => {
      if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    };
  }, [autoRotate, autoRotateInterval, next, count]);

  // Pause on hover/drag
  const pauseAutoRotate = () => {
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
  };
  const resumeAutoRotate = () => {
    if (!autoRotate || count <= 1) return;
    if (autoRotateRef.current) clearInterval(autoRotateRef.current);
    autoRotateRef.current = setInterval(next, autoRotateInterval);
  };

  // Drag
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    pauseAutoRotate();
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const dx = e.clientX - dragStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
    }
    resumeAutoRotate();
  };

  if (count === 0) return null;

  // Compute visible items (up to 5 on each side)
  const getItemStyle = (index: number) => {
    let offset = index - activeIndex;
    // Wrap around for circular arrangement
    if (offset > count / 2) offset -= count;
    if (offset < -count / 2) offset += count;

    const absOffset = Math.abs(offset);
    const isActive = offset === 0;

    if (absOffset > 3) {
      return { opacity: 0, display: "none" as const };
    }

    const translateX = offset * 155;
    const translateZ = -absOffset * 60;
    const rotateY = offset * -10;
    const scale = isActive ? 1.05 : Math.max(0.78, 1 - absOffset * 0.1);
    const opacity = isActive ? 1 : Math.max(0.45, 1 - absOffset * 0.25);
    const zIndex = 10 - absOffset;

    return {
      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity,
      zIndex,
      display: "block" as const,
    };
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full select-none", className)}
      onMouseEnter={pauseAutoRotate}
      onMouseLeave={resumeAutoRotate}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{ perspective: "1200px" }}
    >
      <div className="relative flex items-center justify-center" style={{ height }}>
        <AnimatePresence initial={false}>
          {items.map((item, index) => {
            const style = getItemStyle(index);
            if (style.display === "none") return null;

            return (
              <motion.div
                key={item.id}
                className="absolute cursor-pointer"
                style={{
                  transformStyle: "preserve-3d",
                  ...style,
                }}
                animate={{
                  transform: style.transform,
                  opacity: style.opacity,
                }}
                transition={{
                  duration: 0.5,
                  ease: [0.32, 0.72, 0, 1],
                }}
                onClick={() => goTo(index)}
              >
                {item.content}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      {count > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === activeIndex
                  ? "w-6 bg-brand-blue"
                  : "w-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
