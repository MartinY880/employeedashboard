// ProConnect — TopNav Component
// White navigation bar: logo, nav links, search icon, notification bell, user avatar + dropdown

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, BookOpen, LogOut, Settings, ShieldCheck, Volume2, VolumeX, Trophy } from "lucide-react";
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
import { useSounds } from "@/components/shared/SoundProvider";
import { useBranding } from "@/hooks/useBranding";
import type { AuthUser } from "@/types";
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

export function TopNav({ user }: TopNavProps) {
  const pathname = usePathname();
  const { muted, toggleMute } = useSounds();
  const { branding } = useBranding();

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
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors outline-none">
              <Avatar className="h-8 w-8 border-2 border-brand-blue/20">
                <AvatarImage
                  src={user.avatar || `/api/directory/photo?userId=${encodeURIComponent(user.sub)}&name=${encodeURIComponent(user.name)}&size=48x48`}
                  alt={user.name}
                />
                <AvatarFallback className="bg-brand-blue text-white text-xs font-semibold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
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
            {user.role === "ADMIN" && (
              <DropdownMenuItem asChild>
                <Link href="/admin" className="cursor-pointer">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Admin Panel
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/dashboard" className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Link>
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
    </header>
  );
}
