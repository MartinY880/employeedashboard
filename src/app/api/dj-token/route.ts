import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LOGTO_COOKIE_KEY, isLogtoConfigured, logtoConfig } from "@/lib/logto";

const DJ_API_RESOURCE = process.env.LOGTO_DJ_APP_RESOURCE || "https://dj.api";

export async function GET() {
  if (!isLogtoConfigured) {
    return NextResponse.json({ token: null });
  }

  const cookieStore = await cookies();
  if (!cookieStore.has(LOGTO_COOKIE_KEY)) {
    return NextResponse.json({ token: null });
  }

  try {
    const { getLogtoContext } = await import("@logto/next/server-actions");

    const context = await getLogtoContext(logtoConfig, {
      getAccessToken: true,
      resource: DJ_API_RESOURCE,
    });

    if (!context.isAuthenticated) {
      return NextResponse.json({ token: null });
    }

    const token = (context as Record<string, unknown>).accessToken;
    if (typeof token !== "string") {
      return NextResponse.json({ token: null });
    }

    const claims = (context.claims as Record<string, unknown>) ?? {};
    const userId = typeof claims.sub === "string" ? claims.sub : null;
    const displayName = typeof claims.name === "string" ? claims.name : null;

    return NextResponse.json({ token, userId, displayName });
  } catch (error) {
    console.error("[DJ-token] failed:", error);
    return NextResponse.json({ token: null });
  }
}
