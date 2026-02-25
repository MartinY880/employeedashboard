// ProConnect — TopNav Component
// White navigation bar: logo, nav links, user avatar + dropdown with notification lightbox

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, CalendarDays, BookOpen, LogOut, Bell, ShieldCheck, Volume2, VolumeX, Trophy, Award, Star, Lightbulb, CheckCheck, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSounds } from "@/components/shared/SoundProvider";
import { useBranding } from "@/hooks/useBranding";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import type { AuthUser } from "@/types";
import { hasAnyAdminPermission } from "@/lib/rbac";
import { signOutAction } from "@/app/(auth)/sign-in/actions";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/directory", label: "Directory", icon: Users },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tournament", label: "Tournament", icon: Trophy },
  { href: "/resources", label: "Resources", icon: BookOpen },
];

interface TopNavProps {
  user: AuthUser;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "KUDOS": return <Award className="w-4 h-4 text-amber-500 shrink-0" />;
    case "HIGHLIGHT": return <Star className="w-4 h-4 text-blue-500 shrink-0" />;
    case "IDEA_SELECTED": return <Lightbulb className="w-4 h-4 text-green-500 shrink-0" />;
    default: return <Bell className="w-4 h-4 text-gray-400 shrink-0" />;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const { muted, toggleMute } = useSounds();
  const { branding } = useBranding();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const shouldUseProxyAvatar = !user.avatar || user.avatar.includes("graph.microsoft.com");
  const avatarSrc = shouldUseProxyAvatar
    ? `/api/directory/photo?userId=${encodeURIComponent(user.sub)}&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.name)}&size=48x48`
    : user.avatar;

  return (
    <header
      className="sticky top-0 z-50 flex items-center border-b border-gray-200 bg-white/95 backdrop-blur-sm px-3 sm:px-6 shadow-sm"
    >
      {/* Logo */}
      <Link href="/dashboard" className="mr-4 sm:mr-10 flex items-center group shrink-0">
        {branding.logoData ? (
          <img
            src={branding.logoData}
            alt="Logo"
            className="w-auto object-contain transition-transform group-hover:scale-105"
            style={{ height: 'clamp(48px, 8vw, 72px)', maxWidth: 'clamp(240px, 28vw, 420px)' }}
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-blue text-white font-bold text-sm transition-transform group-hover:scale-105">
            MP
          </div>
        )}
      </Link>

      {/* Nav Links */}
      <nav className="flex items-center gap-1 flex-grow">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                isActive
                  ? "text-brand-blue bg-blue-50"
                  : "text-brand-grey hover:text-brand-blue hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:inline">{label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-brand-blue rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-grey hover:text-brand-blue hover:bg-gray-100 transition-all"
            >
              {muted ? <VolumeX className="w-[18px] h-[18px]" /> : <Volume2 className="w-[18px] h-[18px]" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{muted ? "Unmute sounds" : "Mute sounds"}</TooltipContent>
        </Tooltip>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors outline-none">
              <Avatar className="h-8 w-8 border-2 border-brand-blue/20">
                <AvatarImage
                  src={avatarSrc}
                  alt={user.name}
                />
                <AvatarFallback className="bg-brand-blue text-white text-xs font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              {unreadCount > 0 && (
                <span className="absolute top-0 left-6 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              )}
              <span className="text-sm font-medium text-gray-700 hidden lg:block">
                {user.name}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {hasAnyAdminPermission(user) && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => setNotifOpen(true)}
              className="cursor-pointer"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
              {unreadCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="flex items-center w-full cursor-pointer text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Notifications Lightbox */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-brand-blue" />
                Notifications
                {unreadCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </DialogTitle>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1 text-xs text-brand-blue hover:underline mr-8"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Bell className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-xs mt-1">You&apos;ll see updates here when you receive props, highlights, or idea selections.</p>
              </div>
            ) : (
              <>
              {notifications.map((n: Notification) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.read) markAsRead([n.id]); }}
                  className={`w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${
                    !n.read ? "bg-blue-50/60" : ""
                  }`}
                >
                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 shrink-0">
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <div className="mt-2 shrink-0">
                      <div className="h-2.5 w-2.5 rounded-full bg-brand-blue" />
                    </div>
                  )}
                </button>
              ))}
              <div className="px-5 py-3 border-t bg-gray-50">
                <button
                  onClick={() => clearAll()}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium py-1.5 rounded-md hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all notifications
                </button>
              </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
