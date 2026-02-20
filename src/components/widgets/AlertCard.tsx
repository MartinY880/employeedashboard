// ProConnect — AlertCard Widget
// Single alert card: icon + colored left border + content + optional badge & timestamp

"use client";

import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface AlertCardProps {
  icon: LucideIcon;
  title: string;
  content: string;
  borderColor?: string;
  iconColor?: string;
  badge?: ReactNode;
  timestamp?: string;
}

function formatAlertTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export function AlertCard({
  icon: Icon,
  title,
  content,
  borderColor = "border-l-brand-blue",
  iconColor = "text-brand-blue",
  badge,
  timestamp,
}: AlertCardProps) {
  return (
    <div className={`bg-white p-4 rounded-xl border border-gray-100 border-l-4 ${borderColor} flex gap-3.5 items-start shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 shrink-0 mt-0.5`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="text-sm leading-relaxed min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-gray-800 mb-0.5">{title}</div>
          {badge}
        </div>
        <div className="text-brand-grey text-[13px]">{content}</div>
        {timestamp && (
          <div className="text-[10px] text-brand-grey/70 mt-1.5">
            {formatAlertTime(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}
