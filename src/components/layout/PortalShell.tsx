// ProConnect — PortalShell Component
// Combines TopNav + BlueStrip + scrollable main content area

"use client";

import { type ReactNode } from "react";
import { TopNav } from "./TopNav";
import { BlueStrip } from "./BlueStrip";
import type { AuthUser } from "@/types";

interface PortalShellProps {
  children: ReactNode;
  user: AuthUser;
}

export function PortalShell({ children, user }: PortalShellProps) {
  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <TopNav user={user} />
      <BlueStrip userName={user.name} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
