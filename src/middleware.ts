// ProConnect — Next.js Middleware
// Route protection — redirects unauthenticated users to sign-in
// Uses lightweight cookie check; full verification happens in layouts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for public routes
  if (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  // Check for Logto session cookie
  // Cookie key format: logto_<appId>
  const appId = process.env.LOGTO_APP_ID;
  const isLogtoConfigured = !!process.env.LOGTO_ENDPOINT && !!appId;

  if (!isLogtoConfigured) {
    // Dev mode bypass — no Logto configured, allow all
    return NextResponse.next();
  }

  const cookieKey = `logto_${appId}`;
  const hasSession = request.cookies.has(cookieKey);

  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/directory") ||
    pathname.startsWith("/admin");

  if (isProtectedRoute && !hasSession) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files, _next, and api (except auth check)
    "/((?!_next/static|_next/image|favicon.ico|sounds|api).*)",
  ],
};
