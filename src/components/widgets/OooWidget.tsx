// ProConnect — OooWidget
// OOF status display + time-off request form with email forwarding (center column)

"use client";

import { useState } from "react";
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
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const [internalMsg, setInternalMsg] = useState(
    "I am currently out of the office and will respond to your message upon my return."
  );
  const [enableForwarding, setEnableForwarding] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");
  const [forwardName, setForwardName] = useState("");

  const isActive = oof?.status === "alwaysEnabled" || oof?.status === "scheduled";
  const hasForwarding = oof?.forwarding?.enabled && oof?.forwarding?.forwardTo;

  const handleSubmit = async () => {
    if (!startDate || !endDate) return;

    const settings: Record<string, unknown> = {
      status: "scheduled",
      externalAudience: "all",
      scheduledStartDateTime: new Date(startDate).toISOString(),
      scheduledEndDateTime: new Date(endDate).toISOString(),
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
        {hasForwarding && (
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
              <span className="text-xs text-gray-700 truncate">
                {oof?.forwarding?.forwardTo}
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700">
              Active
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
          <>
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
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-brand-grey/30"
              onClick={() => {
                setShowForm(!showForm);
                playSound("click");
              }}
            >
              <Clock className="w-3.5 h-3.5 mr-1.5" />
              Schedule
            </Button>
          </>
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
            <div className="space-y-3 border-t border-gray-100 pt-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2 w-3.5 h-3.5 text-brand-grey pointer-events-none" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-8 text-xs h-8"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2 w-3.5 h-3.5 text-brand-grey pointer-events-none" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-8 text-xs h-8"
                      min={startDate || new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>
              </div>

              {/* Auto-Reply Message */}
              <div>
                <label className="text-[11px] font-medium text-gray-500 mb-1 block">
                  Auto-Reply Message
                </label>
                <textarea
                  value={internalMsg}
                  onChange={(e) => setInternalMsg(e.target.value)}
                  rows={2}
                  className="w-full text-xs px-3 py-2 rounded-md border border-gray-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/30 outline-none resize-none"
                />
              </div>

              {/* Email Forwarding */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => {
                      setEnableForwarding(!enableForwarding);
                      playSound("click");
                    }}
                    className={`relative w-8 h-[18px] rounded-full transition-colors ${
                      enableForwarding ? "bg-brand-blue" : "bg-gray-300"
                    }`}
                  >
                    <motion.div
                      className="absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm"
                      animate={{ left: enableForwarding ? 14 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Forward className="w-3.5 h-3.5 text-brand-grey" />
                    <span className="text-[11px] font-medium text-gray-600 group-hover:text-gray-800 transition-colors">
                      Forward emails while away
                    </span>
                  </div>
                </label>

                <AnimatePresence>
                  {enableForwarding && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
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
                        placeholder="Search name or email @mtgpros.com..."
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white text-xs"
                  onClick={handleSubmit}
                  disabled={isSaving || !startDate || !endDate}
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
                  className="text-xs"
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
