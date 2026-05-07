// ProConnect — Flyer Widget
// Displays active flyers in a carousel. Click to enlarge. < 1/2 > navigation.

"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Flyer {
  id: string;
  title: string;
  filename: string;
}

export function FlyerWidget() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    fetch("/api/flyers?active=true")
      .then((r) => r.json())
      .then((data) => {
        if (data.flyers?.length) setFlyers(data.flyers);
      })
      .catch(() => {});
  }, []);

  if (!flyers.length) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center gap-2">
          <ImageIcon className="w-3.5 h-3.5 text-brand-blue" />
          <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase leading-none">Flyers</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">No flyers right now</p>
        </div>
      </div>
    );
  }

  const current = flyers[activeIndex];
  const imageUrl = `/api/flyers/image/${current.filename}`;

  const goPrev = () => setActiveIndex((i) => (i - 1 + flyers.length) % flyers.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % flyers.length);

  return (
    <>
      <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-3.5 py-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ImageIcon className="w-3.5 h-3.5 text-brand-blue shrink-0" />
            <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase leading-none">Flyers</h3>
          </div>
          {flyers.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-blue transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] tabular-nums text-gray-400 min-w-[28px] text-center">
                {activeIndex + 1} / {flyers.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-brand-blue transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Flyer Image — added min-h-[220px] so it doesn't collapse on mobile */}
        <div
          className="flex-1 min-h-[180px] lg:min-h-0 overflow-hidden cursor-pointer relative"
          onClick={() => setEnlarged(true)}
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={current.id}
              src={imageUrl}
              alt={current.title}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full object-contain"
              draggable={false}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Enlarged modal */}
      {enlarged && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setEnlarged(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              className="absolute -top-3 -right-3 z-10 p-1.5 bg-white dark:bg-gray-900 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Navigation for enlarged view */}
            {flyers.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 p-2 bg-white dark:bg-gray-900 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-brand-blue transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 p-2 bg-white dark:bg-gray-900 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-brand-blue transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <AnimatePresence mode="wait">
              <motion.img
                key={current.id}
                src={imageUrl}
                alt={current.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
                draggable={false}
              />
            </AnimatePresence>

            {/* Title + counter */}
            <div className="mt-3 text-center">
              <p className="text-sm font-medium text-white">{current.title}</p>
              {flyers.length > 1 && (
                <p className="text-xs text-gray-300 mt-0.5">{activeIndex + 1} of {flyers.length}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}