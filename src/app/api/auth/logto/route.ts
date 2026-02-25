// ProConnect — Auth API Route
// GET: Return current user context (for client components)
// POST: Trigger sign-out

import { NextResponse } from "next/server";
import { getAuthUser, getAuthScopeDebugInfo } from "@/lib/logto";

export async function GET(request: Request) {
  const { isAuthenticated, user } = await getAuthUser();
  const { searchParams } = new URL(request.url);
  const includeDebug = searchParams.get("debug") === "1";

  if (!includeDebug) {
    return NextResponse.json({ isAuthenticated, user });
  }

  const debug = await getAuthScopeDebugInfo();
  console.info("[Auth Debug] /api/auth/logto?debug=1", {
    isAuthenticated,
    userSub: user?.sub ?? null,
    userRole: user?.role ?? null,
    userPermissions: user?.permissions ?? [],
    debug,
  });
  return NextResponse.json({ isAuthenticated, user, debug });
}
