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
import type { IconType } from "react-icons";
import * as FaIcons from "react-icons/fa";
import * as Fa6Icons from "react-icons/fa6";
import * as MdIcons from "react-icons/md";
import * as BsIcons from "react-icons/bs";
import * as TbIcons from "react-icons/tb";
import * as Hi2Icons from "react-icons/hi2";
import * as Io5Icons from "react-icons/io5";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import * as FaBrandIcons from "@fortawesome/free-brands-svg-icons";
import * as FaSolidIcons from "@fortawesome/free-solid-svg-icons";
import { NMLSIcon } from "@/components/shared/icons/NMLSIcon";

interface IconOption {
  id: string;
  label: string;
  library: "lucide" | "react-icons" | "fontawesome";
  keywords: string[];
}

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
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
  nmls: NMLSIcon as unknown as LucideIcon,
};

const REACT_ICON_SET_DEFS = [
  { key: "fa", label: "React Icons • FA", icons: FaIcons },
  { key: "fa6", label: "React Icons • FA6", icons: Fa6Icons },
  { key: "md", label: "React Icons • Material", icons: MdIcons },
  { key: "bs", label: "React Icons • Bootstrap", icons: BsIcons },
  { key: "tb", label: "React Icons • Tabler", icons: TbIcons },
  { key: "hi2", label: "React Icons • Heroicons", icons: Hi2Icons },
  { key: "io5", label: "React Icons • Ionicons", icons: Io5Icons },
] as const;

const REACT_ICON_MAP: Record<string, IconType> = REACT_ICON_SET_DEFS.reduce(
  (acc, setDef) => {
    Object.entries(setDef.icons).forEach(([exportName, icon]) => {
      if (typeof icon === "function" && /^[A-Z]/.test(exportName)) {
        acc[`${setDef.key}:${exportName}`] = icon as IconType;
      }
    });
    return acc;
  },
  {} as Record<string, IconType>
);

const REACT_ICON_LEGACY_ALIAS: Record<string, string> = {
  salesforce: "fa:FaSalesforce",
  slack: "fa:FaSlack",
  github: "fa:FaGithub",
  microsoft: "fa:FaMicrosoft",
  google: "fa:FaGoogle",
  jira: "fa:FaJira",
  atlassian: "fa:FaAtlassian",
};

const isFontAwesomeIconDefinition = (value: unknown): value is IconDefinition => {
  if (!value || typeof value !== "object") return false;
  return "iconName" in value && "prefix" in value;
};

const FONT_AWESOME_SET_DEFS = [
  { key: "brands", label: "Font Awesome • Brands", icons: FaBrandIcons },
  { key: "solid", label: "Font Awesome • Solid", icons: FaSolidIcons },
] as const;

const FONT_AWESOME_ICON_MAP: Record<string, IconDefinition> = FONT_AWESOME_SET_DEFS.reduce(
  (acc, setDef) => {
    Object.values(setDef.icons).forEach((iconDef) => {
      if (isFontAwesomeIconDefinition(iconDef)) {
        acc[`${setDef.key}:${iconDef.iconName}`] = iconDef;
      }
    });
    return acc;
  },
  {} as Record<string, IconDefinition>
);

const FONT_AWESOME_LEGACY_ALIAS: Record<string, string> = {
  salesforce: "brands:salesforce",
  briefcase: "solid:briefcase",
  cloud: "solid:cloud",
  globe: "solid:globe",
  link: "solid:link",
  gear: "solid:gear",
};

const toTitleCase = (value: string) =>
  value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const LUCIDE_OPTIONS: IconOption[] = Object.keys(LUCIDE_ICON_MAP).map((name) => ({
  id: `lucide:${name}`,
  label: name === "nmls" ? "NMLS" : toTitleCase(name),
  library: "lucide",
  keywords: [name, "lucide", ...(name === "nmls" ? ["mortgage", "licensing"] : [])],
}));

const REACT_ICON_OPTIONS: IconOption[] = REACT_ICON_SET_DEFS.flatMap((setDef) => {
  return Object.keys(setDef.icons)
    .filter((exportName) => /^[A-Z]/.test(exportName))
    .map((exportName) => ({
      id: `react-icons:${setDef.key}:${exportName}`,
      label: exportName,
      library: "react-icons" as const,
      keywords: [
        setDef.key,
        setDef.label,
        exportName,
        exportName.toLowerCase(),
        "react-icons",
      ],
    }));
});

const FONT_AWESOME_OPTIONS: IconOption[] = FONT_AWESOME_SET_DEFS.flatMap((setDef) => {
  return Object.entries(setDef.icons).reduce<IconOption[]>((acc, [exportName, iconDef]) => {
    if (!isFontAwesomeIconDefinition(iconDef)) return acc;

    acc.push({
      id: `fontawesome:${setDef.key}:${iconDef.iconName}`,
      label: iconDef.iconName,
      library: "fontawesome",
      keywords: [
        setDef.key,
        setDef.label,
        exportName,
        exportName.toLowerCase(),
        iconDef.iconName,
        "fontawesome",
        "fa",
      ],
    });

    return acc;
  }, []);
});

export const AVAILABLE_ICON_OPTIONS: IconOption[] = [
  ...LUCIDE_OPTIONS,
  ...REACT_ICON_OPTIONS,
  ...FONT_AWESOME_OPTIONS,
];

export const AVAILABLE_ICONS = AVAILABLE_ICON_OPTIONS.map((option) => option.id);

export const normalizeQuickLinkIconId = (icon: string): string => {
  if (!icon) return "lucide:link";
  if (icon.startsWith("fontawesome:")) {
    const raw = icon.slice("fontawesome:".length);
    if (FONT_AWESOME_ICON_MAP[raw]) return icon;
    if (FONT_AWESOME_LEGACY_ALIAS[raw]) return `fontawesome:${FONT_AWESOME_LEGACY_ALIAS[raw]}`;
  }
  if (icon.includes(":")) return icon;
  if (LUCIDE_ICON_MAP[icon]) return `lucide:${icon}`;
  if (REACT_ICON_LEGACY_ALIAS[icon]) return `react-icons:${REACT_ICON_LEGACY_ALIAS[icon]}`;
  if (FONT_AWESOME_LEGACY_ALIAS[icon]) return `fontawesome:${FONT_AWESOME_LEGACY_ALIAS[icon]}`;
  return "lucide:link";
};

export const renderQuickLinkIconPreview = (icon: string, className = "w-3.5 h-3.5") => {
  const normalized = normalizeQuickLinkIconId(icon);
  const [library, setOrName, maybeName] = normalized.split(":");

  if (library === "react-icons") {
    const resolvedName = maybeName ? `${setOrName}:${maybeName}` : (REACT_ICON_LEGACY_ALIAS[setOrName] ?? "fa:FaLink");
    const ReactIcon = REACT_ICON_MAP[resolvedName] ?? LinkIcon;
    return <ReactIcon className={className} />;
  }

  if (library === "fontawesome") {
    const resolvedName = maybeName ? `${setOrName}:${maybeName}` : (FONT_AWESOME_LEGACY_ALIAS[setOrName] ?? "solid:link");
    const fontAwesomeIcon = FONT_AWESOME_ICON_MAP[resolvedName] ?? FONT_AWESOME_ICON_MAP["solid:link"];
    if (fontAwesomeIcon) {
      return <FontAwesomeIcon icon={fontAwesomeIcon} className={className} />;
    }
  }

  const Lucide = LUCIDE_ICON_MAP[setOrName] ?? LinkIcon;
  return <Lucide className={className} />;
};

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
              {renderQuickLinkIconPreview(link.icon, "w-3.5 h-3.5")}
              {link.label}
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
