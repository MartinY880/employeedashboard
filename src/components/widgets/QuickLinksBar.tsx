// ProConnect — QuickLinksBar Widget
// Full-width row of admin-managed quick links above the directory/alerts bar

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  Building2,
  Wallet,
  MessageCircle,
  BookOpen,
  Headset,
  GraduationCap,
  Link as LinkIcon,
  Globe,
  FileText,
  ShieldCheck,
  Users,
  Calendar,
  Mail,
  Phone,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Icon lookup for admin-configurable icons
const ICON_MAP: Record<string, LucideIcon> = {
  link: LinkIcon,
  building: Building2,
  wallet: Wallet,
  "message-circle": MessageCircle,
  "book-open": BookOpen,
  headset: Headset,
  "graduation-cap": GraduationCap,
  globe: Globe,
  "file-text": FileText,
  shield: ShieldCheck,
  users: Users,
  calendar: Calendar,
  mail: Mail,
  phone: Phone,
  settings: Settings,
  external: ExternalLink,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

interface QuickLink {
  id: string;
  label: string;
  url: string;
  icon: string;
  sortOrder: number;
  active: boolean;
}

export function QuickLinksBar() {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/quicklinks");
      const data = await res.json();
      setLinks(data.links || []);
    } catch {
      console.error("Failed to fetch quick links");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  if (isLoading || links.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 flex items-center justify-center gap-1 overflow-x-auto scrollbar-thin">
      <span className="text-[10px] font-bold text-brand-grey uppercase tracking-wider shrink-0 mr-2">
        Quick Links
      </span>
      <div className="flex items-center gap-1 flex-wrap">
        {links.map((link, i) => {
          const Icon = ICON_MAP[link.icon] || LinkIcon;
          return (
            <motion.a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-brand-blue/5 hover:text-brand-blue transition-colors shrink-0"
            >
              <Icon className="w-3.5 h-3.5" />
              {link.label}
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
