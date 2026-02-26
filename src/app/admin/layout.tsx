// ProConnect — Admin Layout
// RBAC guard: users with any admin permission can access admin area

import { type ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/logto";
import { hasAnyAdminPermission } from "@/lib/rbac";
import { PortalShell } from "@/components/layout/PortalShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = await getAuthUser();

  if (!isAuthenticated || !user) {
    redirect("/sign-in");
  }

  if (!hasAnyAdminPermission(user)) {
    console.warn("[RBAC] Admin access denied", {
      sub: user.sub,
      role: user.role,
      permissions: user.permissions,
    });

    // Non-admin users get a 403-style page
    return (
      <PortalShell user={user}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
            <svg className="w-8 h-8 text-alert-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
          <p className="text-brand-grey text-sm">You do not have admin privileges to view this page.</p>
        </div>
      </PortalShell>
    );
  }

  return <PortalShell user={user}>{children}</PortalShell>;
}
