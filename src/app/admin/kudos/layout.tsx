import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/PortalShell";

export default async function KudosAdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = await getAuthUser();

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  if (!hasPermission(user, PERMISSIONS.MANAGE_KUDOS)) {
    return (
      <PortalShell user={user}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-brand-grey text-sm">You don&apos;t have permission to manage kudos.</p>
        </div>
      </PortalShell>
    );
  }

  return children;
}
