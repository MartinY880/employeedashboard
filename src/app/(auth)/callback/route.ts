// ProConnect — Logto OIDC Callback (Route Handler)
// Must be a route handler (not a page) so handleSignIn can set cookies

import { handleSignIn } from "@logto/next/server-actions";
import { isLogtoConfigured, logtoConfig } from "@/lib/logto";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!isLogtoConfigured) {
    return NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
  }

  try {
    await handleSignIn(logtoConfig, request.nextUrl.searchParams);

    return NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
  } catch (error) {
    console.error("[ProConnect] Auth callback failed:", error);

    return NextResponse.redirect(new URL("/sign-in", logtoConfig.baseUrl));
  }
}
