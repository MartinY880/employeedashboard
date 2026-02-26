// ProConnect — Admin Dashboard Overview
// Quick stats and navigation to admin sub-pages

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  MessageCircle,
  Users,
  CalendarDays,
  ArrowRight,
  Shield,
  TrendingUp,
  Activity,
  Columns3,
  Lightbulb,
  Link2,
  Star,
  Paintbrush,
  Trophy,
  FolderOpen,
  ImageIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS, ROUTE_PERMISSION, type Permission } from "@/lib/rbac";

interface AdminStats {
  totalAlerts: number;
  activeAlerts: number;
  totalProps: number;
  propsThisMonth: number;
  teamMembers: number;
  upcomingHolidays: number;
}

function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [alertsAll, alertsActive, propsAll, propsMonth, team, holidays] =
          await Promise.all([
            fetch("/api/alerts?count=true&active=false").then((r) => r.json()),
            fetch("/api/alerts?count=true").then((r) => r.json()),
            fetch("/api/kudos?count=true").then((r) => r.json()),
            fetch("/api/kudos?count=true&month=true").then((r) => r.json()),
            fetch("/api/directory?count=true").then((r) => r.json()),
            fetch("/api/stats").then((r) => r.json()),
          ]);

        setStats({
          totalAlerts: alertsAll.count ?? 0,
          activeAlerts: alertsActive.count ?? 0,
          totalProps: propsAll.count ?? 0,
          propsThisMonth: propsMonth.count ?? 0,
          teamMembers: team.count ?? 0,
          upcomingHolidays: holidays.upcomingHolidays ?? 0,
        });
      } catch {
        setStats({
          totalAlerts: 5,
          activeAlerts: 3,
          totalProps: 24,
          propsThisMonth: 8,
          teamMembers: 42,
          upcomingHolidays: 6,
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  return { stats, isLoading };
}

const statCards = [
  { key: "activeAlerts", label: "Active Alerts", icon: AlertTriangle, color: "bg-amber-500", href: "/admin/alerts" },
  { key: "totalProps", label: "Total Props", icon: MessageCircle, color: "bg-brand-blue", href: "/admin/kudos" },
  { key: "teamMembers", label: "Team Members", icon: Users, color: "bg-green-500", href: "/directory" },
  { key: "upcomingHolidays", label: "Holidays", icon: CalendarDays, color: "bg-purple-500", href: "/admin/calendar" },
] as const;

const adminPages = [
  {
    title: "Alerts Management",
    description: "Create, edit, toggle, and delete company-wide alerts. Set priority levels and alert types.",
    icon: AlertTriangle,
    href: "/admin/alerts",
    badge: "CRUD",
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    permission: PERMISSIONS.MANAGE_ALERTS,
  },
  {
    title: "Props Moderation",
    description: "Review all props messages. Remove inappropriate content and monitor engagement.",
    icon: MessageCircle,
    href: "/admin/kudos",
    badge: "Moderate",
    color: "text-brand-blue",
    bgColor: "bg-blue-50",
    permission: PERMISSIONS.MANAGE_KUDOS,
  },
  {
    title: "Company Pillars",
    description: "Edit the pillar cards on the dashboard — set icons, titles, and messages for each pillar.",
    icon: Columns3,
    href: "/admin/pillars",
    badge: "Edit",
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    permission: PERMISSIONS.MANAGE_PILLARS,
  },
  {
    title: "Be Brilliant Moderation",
    description: "Review employee ideas, select top ideas for implementation, archive or remove inappropriate ones.",
    icon: Lightbulb,
    href: "/admin/ideas",
    badge: "Moderate",
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    permission: PERMISSIONS.MANAGE_IDEAS,
  },
  {
    title: "Quick Links",
    description: "Add, edit, reorder, and toggle quick links shown on the employee dashboard.",
    icon: Link2,
    href: "/admin/quicklinks",
    badge: "CRUD",
    color: "text-teal-500",
    bgColor: "bg-teal-50",
    permission: PERMISSIONS.MANAGE_QUICKLINKS,
  },
  {
    title: "Resources Page",
    description: "Control resources shown to employees — add, edit, hide, or remove cards by category.",
    icon: FolderOpen,
    href: "/admin/resources",
    badge: "CRUD",
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    permission: PERMISSIONS.MANAGE_RESOURCES,
  },
  {
    title: "Employee Highlights",
    description: "Spotlight employees on the dashboard — highlight achievements, milestones, and recognition.",
    icon: Star,
    href: "/admin/highlights",
    badge: "CRUD",
    color: "text-amber-500",
    bgColor: "bg-amber-50",
    permission: PERMISSIONS.MANAGE_HIGHLIGHTS,
  },
  {
    title: "Site Branding",
    description: "Upload a custom logo, favicon, and set the company name displayed across the portal.",
    icon: Paintbrush,
    href: "/admin/branding",
    badge: "Upload",
    color: "text-brand-blue",
    bgColor: "bg-blue-50",
    permission: PERMISSIONS.MANAGE_BRANDING,
  },
  {
    title: "Dashboard Slider",
    description: "Manage the full-width media slider on the dashboard — upload images/videos, set height, transition, and style.",
    icon: ImageIcon,
    href: "/admin/slider",
    badge: "Media",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50",
    permission: PERMISSIONS.MANAGE_BRANDING,
  },
  {
    title: "Tournament Bracket",
    description: "Manage tournament brackets — create tournaments, add 2-person teams, set divisions, and record match results.",
    icon: Trophy,
    href: "/admin/tournament",
    badge: "CRUD",
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    permission: PERMISSIONS.MANAGE_TOURNAMENT,
  },
  {
    title: "Calendar Management",
    description: "Create, edit, and delete holidays. Sync federal holidays from external APIs. Toggle visibility and manage categories.",
    icon: CalendarDays,
    href: "/admin/calendar",
    badge: "CRUD",
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    permission: PERMISSIONS.MANAGE_CALENDAR,
  },
];

export default function AdminPage() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const { stats, isLoading } = useAdminStats();

  useEffect(() => {
    async function fetchAuth() {
      try {
        const response = await fetch("/api/auth/logto", { cache: "no-store" });
        const data = await response.json();
        if (data?.user?.permissions) {
          setPermissions(data.user.permissions as string[]);
        }
      } catch {
        // Keep safe default
      }
    }
    fetchAuth();
  }, []);

  const userPerms = new Set(permissions);
  const visibleAdminPages = adminPages.filter((page) => userPerms.has(page.permission));
  const visibleStatCards = statCards.filter((card) => {
    const perm = ROUTE_PERMISSION[card.href];
    return !perm || userPerms.has(perm);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-[1200px] mx-auto px-6 py-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue text-white">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-brand-grey">Manage alerts, props, and portal settings</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visibleStatCards.map((card, i) => {
          const Icon = card.icon;
          const value = stats ? stats[card.key as keyof AdminStats] : 0;

          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <Link
                href={card.href}
                className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-brand-blue/20 transition-all group"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${card.color} text-white shrink-0`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  {isLoading ? (
                    <>
                      <Skeleton className="h-7 w-12 mb-1" />
                      <Skeleton className="h-3.5 w-20" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold text-gray-900">{value}</div>
                      <div className="text-xs text-brand-grey font-medium">{card.label}</div>
                    </>
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Stats Bar */}
      {!isLoading && stats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-brand-blue/5 rounded-xl border border-brand-blue/10 p-4 flex items-center gap-6 flex-wrap"
        >
          <div className="flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-brand-blue" />
            <span className="text-brand-grey">This month:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            <span className="text-sm font-semibold text-gray-800">{stats.propsThisMonth} props</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-sm font-semibold text-gray-800">{stats.activeAlerts} active alerts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-sm font-semibold text-gray-800">{stats.upcomingHolidays} upcoming holidays</span>
          </div>
        </motion.div>
      )}

      {/* Admin Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAdminPages.map((page, i) => {
          const Icon = page.icon;
          return (
            <motion.div
              key={page.href}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
            >
              <Link
                href={page.href}
                className="flex items-start gap-4 bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-brand-blue/20 transition-all group"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${page.bgColor} shrink-0`}>
                  <Icon className={`w-5 h-5 ${page.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800 group-hover:text-brand-blue transition-colors">
                      {page.title}
                    </h3>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{page.badge}</Badge>
                  </div>
                  <p className="text-sm text-brand-grey leading-relaxed">{page.description}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-brand-grey group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
