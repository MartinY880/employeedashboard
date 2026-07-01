// ProConnect — Rebuttal of the Day Widget
// Displays the current rotating objection/rebuttal pair from the database

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquareQuote, AlertCircle, ShieldCheck, ArrowRight } from "lucide-react";

interface Rebuttal {
  id: string;
  objection: string;
  rebuttal: string;
  isActive: boolean;
  lastShownAt: string | null;
}

export function RebuttalOfTheDayWidget() {
  const [rebuttal, setRebuttal] = useState<Rebuttal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rebuttals")
      .then((r) => r.json())
      .then((data: Rebuttal | null) => {
        if (data?.id) setRebuttal(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-pulse" style={{ background: "#fff" }}>
        <div style={{ height: 3, background: "#06427F" }} />
        <div style={{ background: "#f3f8ff", borderBottom: "1px solid #e6eef8" }} className="px-5 py-4">
          <div className="h-4 w-44 rounded bg-blue-100" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1px 3fr" }}>
          <div style={{ padding: "26px 30px", background: "#fbfaf7" }}>
            <div className="h-3 w-24 rounded bg-amber-100 mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-5/6 rounded bg-gray-100" />
            </div>
          </div>
          <div style={{ background: "#e9edf2" }} />
          <div style={{ padding: "26px 30px", background: "#f6faff" }}>
            <div className="h-3 w-24 rounded bg-blue-100 mb-3" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-gray-100" />
              <div className="h-4 w-4/5 rounded bg-gray-100" />
              <div className="h-4 w-full rounded bg-gray-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!rebuttal) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="rounded-xl border overflow-hidden"
        style={{
          background: "#ffffff",
          borderColor: "#e6e9ee",
          boxShadow: "0 1px 3px rgba(6,66,127,.06), 0 8px 24px rgba(6,66,127,.05)",
        }}
      >
        {/* Header — matches Closers Table style */}
        <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-white dark:from-gray-800 dark:to-gray-900 border-b border-gray-100 dark:border-gray-700 border-t-[3px] border-t-brand-blue flex items-center justify-center gap-2">
          <MessageSquareQuote className="h-4 w-4 text-brand-blue" />
          <h3 className="text-sm font-bold text-brand-blue tracking-wide uppercase">
            Rebuttal of the Day
          </h3>
          <MessageSquareQuote className="h-4 w-4 text-brand-blue" />
        </div>

        {/* Two-column split */}
        <div className="relative" style={{ display: "grid", gridTemplateColumns: "2fr 1px 3fr" }}>

          {/* Left: Objection */}
          <div className="relative" style={{ padding: "26px 30px 26px 28px", background: "#fbfaf7" }}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#BA7517" }} />
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "#a07520" }}>
                  THE OBJECTION
                </span>
              </div>
              <p
                className="m-0 whitespace-pre-line"
                style={{ fontSize: 16, lineHeight: 1.55, fontWeight: 500, color: "#2b2b28", fontStyle: "italic" }}
              >
                &ldquo;{rebuttal.objection}&rdquo;
              </p>
            </div>
          </div>

          {/* Divider */}
          <div style={{ background: "#e9edf2" }} />

          {/* Right: Rebuttal */}
          <div style={{ padding: "26px 28px 26px 30px", background: "#f6faff" }}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: "#185FA5" }} />
              <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "#185FA5" }}>
                THE REBUTTAL
              </span>
            </div>
            <p className="m-0 whitespace-pre-line" style={{ fontSize: 15, lineHeight: 1.7, color: "#33383f" }}>
              {rebuttal.rebuttal}
            </p>
          </div>

          {/* Center arrow badge */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: "50%",
              left: "40%",
              transform: "translate(-50%, -50%)",
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "#06427F",
              border: "4px solid #ffffff",
              boxShadow: "0 2px 8px rgba(6,66,127,.28)",
              zIndex: 10,
            }}
          >
            <ArrowRight className="w-4 h-4 text-white" />
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
