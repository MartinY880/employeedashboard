// ProConnect — OooWidget
// OOF status display + time-off request form with email forwarding (center column)

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Clock,
  CheckCircle2,
  X,
  Send,
  Calendar,
  Loader2,
  Forward,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOof } from "@/hooks/useOof";
import { useSounds } from "@/components/shared/SoundProvider";
import { PeoplePicker } from "@/components/shared/PeoplePicker";

type SoundName = "click" | "success" | "notify" | "pop";

function formatOofDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildIsoDateTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const parsed = new Date(`${dateStr}T${timeStr}`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

// ── 12-hour time helpers ──
function parseTime12to24(str: string): string | null {
  const match = str.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const p = match[3].toUpperCase();
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  if (p === "AM" && h === 12) h = 0;
  if (p === "PM" && h !== 12) h += 12;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

// Every minute of the day in 12-hour format
const ALL_TIMES: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m++) {
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    ALL_TIMES.push(`${hour12}:${m.toString().padStart(2, "0")} ${period}`);
  }
}

// ── Time ComboBox: type freely OR pick from every-minute dropdown ──
function TimeComboBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Normalize for matching: strip spaces, colons, leading zeros
  const norm = (s: string) => s.toLowerCase().replace(/[\s:]/g, "");

  const filtered = filter
    ? ALL_TIMES.filter((t) => norm(t).includes(norm(filter)))
    : ALL_TIMES;

  // Scroll to the current value when dropdown opens
  useEffect(() => {
    if (open && listRef.current && value) {
      const idx = ALL_TIMES.indexOf(value);
      if (idx > -1) {
        const el = listRef.current.children[idx] as HTMLElement | undefined;
        el?.scrollIntoView({ block: "center" });
      }
    }
  }, [open, value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center border border-gray-200 rounded-lg h-9 bg-white overflow-hidden focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20 transition-shadow">
        <Clock className="w-3.5 h-3.5 text-gray-400 ml-2.5 shrink-0" />
        <input
          type="text"
          value={open ? filter : value}
          onChange={(e) => {
            setFilter(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setFilter(value);
            setOpen(true);
          }}
          placeholder="9:00 AM"
          className="flex-1 text-xs px-2 h-full outline-none bg-transparent"
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen(!open);
            setFilter(value);
          }}
          className="px-2 h-full hover:bg-gray-50 transition-colors border-l border-gray-100"
        >
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {filtered.map((t) => (
              <button
                key={t}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(t);
                  setOpen(false);
                  setFilter("");
                }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-brand-blue/10 transition-colors ${
                  t === value
                    ? "bg-brand-blue/5 text-brand-blue font-medium"
                    : "text-gray-700"
                }`}
              >
                {t}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-400 italic">No matching time</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OooWidget() {
  const { oof, isLoading, isSaving, setOofStatus, disableOof, error } = useOof();
  const sounds = useSounds();
  const playSound = (name: SoundName) => {
    const map = { click: sounds.playClick, success: sounds.playSuccess, notify: sounds.playNotify, pop: sounds.playPop };
    map[name]();
  };

  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("9:00 AM");
  const [endTime, setEndTime] = useState("5:00 PM");
  const [internalMsg, setInternalMsg] = useState(
    "I am currently out of the office and will respond to your message upon my return."
  );
  const [enableForwarding, setEnableForwarding] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");
  const [forwardName, setForwardName] = useState("");

  const isActive = oof?.status === "alwaysEnabled" || oof?.status === "scheduled";
  const forwardingInfo = oof?.forwarding;
  const forwardingIsActive = Boolean(
    forwardingInfo?.isActive && forwardingInfo.forwardTo
  );
  const forwardingIsPending = forwardingInfo?.status === "PENDING";
  const forwardingScheduleText = forwardingInfo?.forwardTo
    ? forwardingIsActive
      ? forwardingInfo.endsAt
        ? `Active until ${formatOofDate(forwardingInfo.endsAt)}`
        : "Forwarding in progress"
      : forwardingIsPending
      ? forwardingInfo.startsAt
        ? `Starts ${formatOofDate(forwardingInfo.startsAt)}`
        : "Scheduled with this OOO"
      : ""
    : "";

  const handleSubmit = async () => {
    const start24 = parseTime12to24(startTime);
    const end24 = parseTime12to24(endTime);

    if (!startDate || !endDate || !start24 || !end24) {
      playSound("notify");
      return;
    }

    const startIso = buildIsoDateTime(startDate, start24);
    const endIso = buildIsoDateTime(endDate, end24);

    if (!startIso || !endIso) {
      playSound("notify");
      return;
    }

    const settings: Record<string, unknown> = {
      status: "scheduled",
      externalAudience: "all",
      scheduledStartDateTime: startIso,
      scheduledEndDateTime: endIso,
      internalReplyMessage: internalMsg,
      externalReplyMessage: internalMsg,
    };

    if (enableForwarding && forwardEmail) {
      settings.forwardToEmail = forwardEmail;
      if (forwardName) settings.forwardToName = forwardName;
    }

    const success = await setOofStatus(settings);

    if (success) {
      playSound("success");
      setShowForm(false);
      setStartDate("");
      setEndDate("");
      setStartTime("9:00 AM");
      setEndTime("5:00 PM");
      setForwardEmail("");
      setForwardName("");
      setEnableForwarding(false);
    }
  };

  const handleDisable = async () => {
    const success = await disableOof();
    if (success) {
      playSound("click");
    }
  };

  const isSubmitDisabled = isSaving || !startDate || !endDate;

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Current Status */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {isActive ? (
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Plane className="w-4 h-4 text-amber-600" />
            </motion.div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-gray-800">
              Auto-Reply Status
            </div>
            <div className="text-xs text-brand-grey">
              {isActive && oof?.status === "scheduled"
                ? `Active: ${formatOofDate(oof.scheduledStartDateTime)} – ${formatOofDate(oof.scheduledEndDateTime)}`
                : isActive
                ? "Always enabled"
                : "Currently in office"}
            </div>
          </div>
        </div>
        <Badge
          variant={isActive ? "default" : "secondary"}
          className={
            isActive
              ? "bg-amber-100 text-amber-700"
              : "bg-green-100 text-green-700"
          }
        >
          {isActive ? "Away" : "Available"}
        </Badge>
      </motion.div>

      {/* Forwarding Status (shown when active) */}
      <AnimatePresence>
        {forwardingInfo?.forwardTo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100"
          >
            <Forward className="w-3.5 h-3.5 text-brand-blue shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-brand-blue font-medium">
                Forwarding to{" "}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-gray-700 truncate">
                  {forwardingInfo.forwardTo}
                </span>
                {forwardingScheduleText && (
                  <span className="text-[10px] text-brand-grey truncate">
                    {forwardingScheduleText}
                  </span>
                )}
              </div>
            </div>
            <Badge
              variant="secondary"
              className={`text-[10px] ${
                forwardingIsActive
                  ? "bg-green-100 text-green-700"
                  : forwardingIsPending
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {forwardingIsActive ? "Active" : forwardingIsPending ? "Pending" : "Scheduled"}
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-md"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex gap-2"
      >
        {isActive ? (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={handleDisable}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5 mr-1.5" />
            )}
            Disable OOF
          </Button>
        ) : (
          <Button
            size="sm"
            className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white text-xs"
            onClick={() => {
              setShowForm(!showForm);
              playSound("click");
            }}
          >
            <Plane className="w-3.5 h-3.5 mr-1.5" />
            Set Out of Office
          </Button>
        )}
      </motion.div>

      {/* Schedule Form */}
      <AnimatePresence>
        {showForm && !isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-gray-100 pt-4">

              {/* ── Start / End — 2-column grid ── */}
              <div className="grid grid-cols-2 gap-3">
                {/* Start */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-8 text-xs h-9 rounded-lg border-gray-200"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Start Time
                  </label>
                  <TimeComboBox value={startTime} onChange={setStartTime} />
                </div>
                {/* End */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-8 text-xs h-9 rounded-lg border-gray-200"
                      min={startDate || new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    End Time
                  </label>
                  <TimeComboBox value={endTime} onChange={setEndTime} />
                </div>
              </div>

              {/* ── Auto-Reply Message ── */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  Auto-Reply
                </label>
                <textarea
                  value={internalMsg}
                  onChange={(e) => setInternalMsg(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none resize-none bg-white transition-shadow"
                  placeholder="Your auto-reply message..."
                />
              </div>

              {/* ── Email Forwarding ── */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setEnableForwarding(!enableForwarding);
                    playSound("click");
                  }}
                  className="flex items-center gap-2.5 w-full group"
                >
                  <div
                    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                      enableForwarding ? "bg-brand-blue" : "bg-gray-300"
                    }`}
                  >
                    <motion.div
                      className="absolute top-[3px] w-[14px] h-[14px] bg-white rounded-full shadow-sm"
                      animate={{ left: enableForwarding ? 17 : 3 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Forward className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-blue transition-colors" />
                    <span className="text-[11px] font-medium text-gray-600 group-hover:text-gray-800 transition-colors">
                      Forward emails while away
                    </span>
                  </div>
                </button>

                <AnimatePresence>
                  {enableForwarding && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className=""
                    >
                      <PeoplePicker
                        value={forwardEmail}
                        selectedName={forwardName}
                        onChange={(email, name) => {
                          setForwardEmail(email);
                          setForwardName(name || "");
                        }}
                        onClear={() => {
                          setForwardEmail("");
                          setForwardName("");
                        }}
                        placeholder="Search name or email..."
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Actions ── */}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white text-xs h-9 rounded-lg shadow-sm shadow-brand-blue/20"
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled}
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {isSaving ? "Saving..." : "Enable OOF"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-9 rounded-lg text-gray-500 hover:text-gray-700"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
