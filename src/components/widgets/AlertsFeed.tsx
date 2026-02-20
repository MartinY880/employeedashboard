// ProConnect — AlertsFeed Widget
// Read-only scrollable list of alerts for employees (right column tab)

"use client";

import { motion } from "framer-motion";
import { AlertCard } from "./AlertCard";
import {
  AlertTriangle,
  Info,
  PartyPopper,
  UserPlus,
  Megaphone,
  Bell,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAlerts } from "@/hooks/useAlerts";
import type { AlertType } from "@/types";
import type { LucideIcon } from "lucide-react";

const ALERT_STYLE: Record<
  AlertType,
  { icon: LucideIcon; borderColor: string; iconColor: string }
> = {
  WARNING: {
    icon: AlertTriangle,
    borderColor: "border-l-amber-400",
    iconColor: "text-amber-500",
  },
  BIRTHDAY: {
    icon: PartyPopper,
    borderColor: "border-l-pink-400",
    iconColor: "text-pink-500",
  },
  NEW_HIRE: {
    icon: UserPlus,
    borderColor: "border-l-green-400",
    iconColor: "text-green-500",
  },
  ANNOUNCEMENT: {
    icon: Megaphone,
    borderColor: "border-l-brand-blue",
    iconColor: "text-brand-blue",
  },
  INFO: {
    icon: Info,
    borderColor: "border-l-sky-400",
    iconColor: "text-sky-500",
  },
};

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  CRITICAL: {
    label: "Critical",
    className: "bg-red-500 text-white text-[9px]",
  },
  HIGH: {
    label: "High",
    className: "bg-amber-500 text-white text-[9px]",
  },
};

export function AlertsFeed() {
  const { alerts, isLoading } = useAlerts();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-xl border border-gray-100 border-l-4 border-l-gray-200 flex gap-3.5"
          >
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-8 text-sm text-brand-grey"
      >
        <Bell className="w-8 h-8 mx-auto mb-2 text-brand-blue/30" />
        <p>No active alerts. All clear!</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => {
        const style = ALERT_STYLE[alert.type] || ALERT_STYLE.INFO;
        const priority = PRIORITY_BADGE[alert.priority];

        return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <AlertCard
              icon={style.icon}
              title={alert.title}
              content={alert.content}
              borderColor={style.borderColor}
              iconColor={style.iconColor}
              badge={
                priority ? (
                  <Badge className={priority.className}>{priority.label}</Badge>
                ) : undefined
              }
              timestamp={alert.createdAt}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
