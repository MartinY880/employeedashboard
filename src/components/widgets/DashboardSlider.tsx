"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DashboardSliderMedia,
  DashboardSliderObjectFit,
  DashboardSliderStyle,
} from "@/lib/dashboard-slider";
export type {
  DashboardSliderMedia,
  DashboardSliderObjectFit,
  DashboardSliderStyle,
} from "@/lib/dashboard-slider";

interface DashboardSliderProps {
  media: DashboardSliderMedia[];
  /** Max height on desktop (px). The slider scales down proportionally on smaller viewports. */
  height: number;
  transitionMs: number;
  style: DashboardSliderStyle;
  objectFit?: DashboardSliderObjectFit;
}

/**
 * Mobile-minimum height so the slider never gets too short on phones.
 * The aspect-ratio approach scales height proportionally with viewport width,
 * but on very narrow screens this prevents it from becoming a tiny sliver.
 */
const MOBILE_MIN_HEIGHT = 160;

/** The reference (design) viewport width the admin-configured height is based on. */
const DESIGN_WIDTH = 1920;

export function DashboardSlider({
  media,
  height,
  transitionMs,
  style,
  objectFit = "cover",
}: DashboardSliderProps) {
  const sanitizedMedia = useMemo(
    () => media
      .map((item): DashboardSliderMedia => ({
        type: item?.type === "video" ? "video" : "image",
        src: String(item?.src || "").trim(),
        ...(typeof item?.mobileSrc === "string" && item.mobileSrc.trim()
          ? { mobileSrc: item.mobileSrc.trim() }
          : {}),
      }))
      .filter((item) => Boolean(item.src)),
    [media]
  );
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track which slides have been "seen" (current or adjacent) so we can lazy-load the rest.
  // Always pre-load the first slide + the next one for smooth transition.
  const [loadedIndices, setLoadedIndices] = useState<Set<number>>(() => new Set([0, 1]));

  useEffect(() => {
    // Pre-load the current slide, the next slide, and the previous slide
    setLoadedIndices((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      next.add((currentIndex + 1) % sanitizedMedia.length);
      if (currentIndex > 0) next.add(currentIndex - 1);
      return next.size !== prev.size ? next : prev;
    });
  }, [currentIndex, sanitizedMedia.length]);

  // Detect mobile viewport for mobileSrc swap
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Intersection observer — only render the slider when it scrolls into view
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || sanitizedMedia.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sanitizedMedia.length);
    }, Math.max(1000, transitionMs));

    return () => window.clearInterval(interval);
  }, [isVisible, sanitizedMedia.length, transitionMs]);

  useEffect(() => {
    if (currentIndex >= sanitizedMedia.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, sanitizedMedia.length]);

  if (sanitizedMedia.length === 0) {
    return null;
  }

  const fitClass = objectFit === "contain" ? "object-contain" : objectFit === "fill" ? "object-fill" : "object-cover";
  const bgClass = objectFit === "contain" ? "bg-gray-100" : "";

  // Responsive sizing: use CSS aspect-ratio so the container scales with viewport width,
  // clamped between MOBILE_MIN_HEIGHT and the admin-configured max height.
  const safeHeight = Math.max(120, height);
  const aspectRatio = `${DESIGN_WIDTH} / ${safeHeight}`;

  function renderSlide(item: DashboardSliderMedia, index: number, absolute = false) {
    const shouldLoad = loadedIndices.has(index);
    // Use mobileSrc on narrow viewports when available (images only)
    const effectiveSrc = isMobile && item.type === "image" && item.mobileSrc
      ? item.mobileSrc
      : item.src;

    if (item.type === "video") {
      return (
        <video
          key={`${item.type}-${index}`}
          src={shouldLoad ? item.src : undefined}
          className={absolute ? `absolute inset-0 h-full w-full ${fitClass} transition-opacity duration-500` : `h-full w-full shrink-0 ${fitClass}`}
          style={absolute ? { opacity: index === currentIndex ? 1 : 0 } : undefined}
          autoPlay={shouldLoad}
          muted
          loop
          playsInline
          preload={index === currentIndex ? "auto" : "none"}
        />
      );
    }

    return (
      <img
        key={`${item.type}-${index}-${isMobile ? "m" : "d"}`}
        src={shouldLoad ? effectiveSrc : undefined}
        alt={`Dashboard slider media ${index + 1}`}
        className={absolute ? `absolute inset-0 h-full w-full ${fitClass} transition-opacity duration-500` : `h-full w-full shrink-0 ${fitClass}`}
        style={absolute ? { opacity: index === currentIndex ? 1 : 0 } : undefined}
        loading={index === 0 ? "eager" : "lazy"}
        decoding={index === 0 ? "sync" : "async"}
      />
    );
  }

  return (
    <div ref={containerRef} className="w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900">
      <div
        className={`relative w-full ${bgClass}`}
        style={{
          aspectRatio,
          maxHeight: `${safeHeight}px`,
          minHeight: `${MOBILE_MIN_HEIGHT}px`,
        }}
      >
        {!isVisible ? (
          <div className="h-full w-full bg-gray-50 animate-pulse" />
        ) : style === "fade" ? (
          sanitizedMedia.map((item, index) => renderSlide(item, index, true))
        ) : (
          <div
            className="flex h-full transition-transform duration-500"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {sanitizedMedia.map((item, index) => renderSlide(item, index))}
          </div>
        )}
      </div>
      {sanitizedMedia.length > 1 ? (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-white dark:bg-gray-900">
          {sanitizedMedia.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                index === currentIndex ? "bg-brand-blue" : "bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
