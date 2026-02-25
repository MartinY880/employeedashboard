import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/layout/PortalShell";
import { getAuthUser } from "@/lib/logto";
import { hasViewOrManagePermission, PERMISSIONS } from "@/lib/rbac";

export default async function ResourcesAdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = await getAuthUser();

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  if (!hasViewOrManagePermission(user, PERMISSIONS.VIEW_QUICKLINKS)) {
    return (
      <PortalShell user={user}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-brand-grey text-sm">You don&apos;t have permission to view resources settings.</p>
        </div>
      </PortalShell>
    );
  }

  return children;
}
