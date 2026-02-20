// ProConnect — Portal Layout
// Authenticated shell wrapping all portal pages (TopNav + BlueStrip + content)

import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/logto";
import { PortalShell } from "@/components/layout/PortalShell";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = await getAuthUser();

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  return <PortalShell user={user}>{children}</PortalShell>;
}
