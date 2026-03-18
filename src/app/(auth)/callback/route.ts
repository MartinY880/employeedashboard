// ProConnect — Logto OIDC Callback (Route Handler)
// Must be a route handler (not a page) so handleSignIn can set cookies

import { handleSignIn, getLogtoContext } from "@logto/next/server-actions";
import { isLogtoConfigured, logtoConfig } from "@/lib/logto";
import { ensureDbUser } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!isLogtoConfigured) {
    return NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
  }

  try {
    await handleSignIn(logtoConfig, request.nextUrl.searchParams);

    // Create or update the User row from Logto identity on every login
    try {
      const context = await getLogtoContext(logtoConfig, {
        fetchUserInfo: true,
      });

      if (context.isAuthenticated) {
        const claims = (context.claims as Record<string, unknown>) ?? {};
        const userInfo = (context.userInfo as Record<string, unknown>) ?? {};
        const info = { ...claims, ...userInfo };

        const sub = (info.sub as string) ?? "";
        const email = (info.email as string) ?? "";
        const name =
          (info.name as string) ??
          (info.username as string) ??
          email.split("@")[0] ??
          "User";

        if (sub && email) {
          await ensureDbUser(sub, email, name);
        }
      }
    } catch (err) {
      // Non-fatal — user record will be created on next API call if this fails
      console.warn("[Auth] Failed to sync user on login:", err);
    }

    const redirectResponse = NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
    // Set the session epoch so the middleware force-logout check passes
    redirectResponse.cookies.set("session_epoch", "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return redirectResponse;
  } catch (error) {
    console.error("[ProConnect] Auth callback failed:", error);

    return NextResponse.redirect(new URL("/sign-in", logtoConfig.baseUrl));
  }
}
