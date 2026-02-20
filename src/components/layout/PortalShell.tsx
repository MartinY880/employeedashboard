// ProConnect — PortalShell Component
// Combines TopNav + BlueStrip + scrollable main content area

"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
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
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
        className="flex-1"
      >
        {children}
      </motion.main>
    </div>
  );
}
