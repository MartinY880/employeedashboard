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
  icon: PillarIconName;
  title: string;
  message: string;
}
