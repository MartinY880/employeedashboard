// ProConnect — Pillar Icon Map
// Maps string icon names to Lucide React components so pillars can be stored as JSON

import {
  Shield,
  Target,
  Users,
  Lightbulb,
  HeartHandshake,
  TrendingUp,
  Star,
  Heart,
  Rocket,
  Award,
  Compass,
  Crown,
  Eye,
  Flag,
  Globe,
  Handshake,
  Key,
  Megaphone,
  Mountain,
  Sparkles,
  Sun,
  ThumbsUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  Shield,
  Target,
  Users,
  Lightbulb,
  HeartHandshake,
  TrendingUp,
  Star,
  Heart,
  Rocket,
  Award,
  Compass,
  Crown,
  Eye,
  Flag,
  Globe,
  Handshake,
  Key,
  Megaphone,
  Mountain,
  Sparkles,
  Sun,
  ThumbsUp,
  Trophy,
  Zap,
};

export type PillarIconName = keyof typeof ICON_MAP;

export const ICON_NAMES = Object.keys(ICON_MAP) as PillarIconName[];

export interface PillarData {
  id: string;
  icon: string;
  title: string;
  message: string;
}

export interface PillarHeader {
  title: string;
  subtitle: string;
  maxWidth?: number;           // px — controls pillar grid container width (default 1100)
  bannerTitleSize?: number;    // px — header banner title font size (default 14)
  bannerSubtitleSize?: number; // px — header banner subtitle font size (default 11)
  cardTitleSize?: number;      // px — all pillar card titles font size (default 14)
  cardMessageSize?: number;    // px — all pillar card messages font size (default 11)
  template?: "v1" | "v2";     // layout template — v1 = card grid (default), v2 = 5×3 table grid
}

/* ── V2 Grid Template Types ───────────────────────────── */

export interface PillarV2Row {
  id: string;
  col1Icon: string;   // icon identifier for column 1
  col1Title: string;  // title text for column 1
  col2Text: string;   // text for column 2
  col3Text: string;   // text for column 3
  col1Color?: string; // hex bg color for column 1 cell
  col2Color?: string; // hex bg color for column 2 cell
  col3Color?: string; // hex bg color for column 3 cell
}

export interface PillarV2Data {
  columnTitles: [string, string, string]; // editable column headers
  columnWidths?: [number, number, number]; // percentage widths for each column (must sum to 100)
  rows: PillarV2Row[];                     // up to 5 rows
}

export const DEFAULT_PILLAR_V2: PillarV2Data = {
  columnTitles: ["Pillar", "What It Means", "How We Live It"],
  rows: [
    { id: "v2r1", col1Icon: "Shield", col1Title: "Integrity", col2Text: "We act with honesty and transparency.", col3Text: "Every decision reflects our values." },
    { id: "v2r2", col1Icon: "Target", col1Title: "Accountability", col2Text: "We own our results.", col3Text: "No excuses — we deliver on commitments." },
    { id: "v2r3", col1Icon: "Users", col1Title: "Teamwork", col2Text: "We collaborate and support each other.", col3Text: "One team, one mission." },
    { id: "v2r4", col1Icon: "Lightbulb", col1Title: "Innovation", col2Text: "We embrace new ideas.", col3Text: "Continuous improvement is our standard." },
    { id: "v2r5", col1Icon: "HeartHandshake", col1Title: "Service", col2Text: "Clients and community come first.", col3Text: "We go above and beyond every day." },
  ],
};
