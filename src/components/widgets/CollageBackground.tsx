// ProConnect — Collage Background
// CSS-columns collage locked to the viewport bounds — no overflow.
// Images display at natural aspect ratio (no cropping). Column count
// is tuned so the total image height roughly fills the visible area.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

interface CollageImage {
  url: string;
  filename: string;
}

export function CollageBackground() {
  const [images, setImages] = useState<CollageImage[]>([]);
  const [opacity, setOpacity] = useState(80);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    fetch("/api/collage-bg")
      .then((r) => r.json())
      .then((data) => {
        if (data?.images?.length) {
          // Shuffle so layout varies on each page load
          const shuffled = [...data.images].sort(() => Math.random() - 0.5);
          setImages(shuffled);
        }
        if (data?.opacity != null) setOpacity(data.opacity);
      })
      .catch(() => {});
  }, []);

  // After images load, measure actual rendered heights and auto-tune column count
  // so the tallest column is as close to container height as possible.
  useEffect(() => {
    if (!images.length) return;

    function recalc() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Start high on columns and decrease until content fills the viewport
      // Use a simple heuristic: with N images and C columns, each column gets ~N/C images.
      // Average image at column-width tends to be roughly square, so column height ≈ (N/C) * (w/C).
      // We want that ≈ h, so C² ≈ N*w/h → C ≈ sqrt(N * w / h)
      const ideal = Math.round(Math.sqrt(images.length * w / h));
      setCols(Math.max(2, Math.min(ideal, 10)));
    }

    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [images.length]);

  // Repeat images enough times to guarantee full viewport coverage with no blanks.
  // The container clips overflow, so extra images are invisible.
  const repeatedImages = useMemo(() => {
    if (!images.length) return [];
    const needed = Math.max(images.length * 5 * cols, images.length * 15);
    const result: CollageImage[] = [];
    for (let i = 0; i < needed; i++) {
      result.push(images[i % images.length]);
    }
    // Shuffle so the same image doesn't land at the same position in every column
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }, [images, cols]);

  // How many images to load eagerly (viewport + 1 extra row).
  // Each column needs roughly (viewportHeight / columnWidth) images to fill,
  // plus 1 extra per column for the buffer row.
  const eagerCount = useMemo(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const colWidth = w / cols;
    const imagesPerCol = Math.ceil(h / colWidth) + 1; // +1 = extra row
    return cols * imagesPerCol;
  }, [cols]);

  if (!images.length) return null;

  const overlayOpacity = opacity / 100;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Overlay — white in light mode, dark in dark mode */}
      <div
        className="absolute inset-0 z-[1] transition-colors"
        style={{ backgroundColor: `var(--collage-overlay)` }}
      />
      <style>{`
        :root { --collage-overlay: rgba(255, 255, 255, ${overlayOpacity}); }
        .dark { --collage-overlay: rgba(3, 7, 18, ${overlayOpacity}); }
      `}</style>

      <div
        className="w-full"
        style={{
          columnCount: cols,
          columnGap: 0,
        }}
      >
        {repeatedImages.map((img, i) => (
          <div
            key={`${img.filename}-${i}`}
            style={{ breakInside: "avoid" }}
          >
            <img
              src={img.url}
              alt=""
              decoding="async"
              loading={i < eagerCount ? "eager" : "lazy"}
              className="w-full block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
