import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  LOGTO_COOKIE_KEY,
  isLogtoConfigured,
  logtoConfig,
} from "@/lib/logto";

const LOGTO_API_RESOURCE = process.env.LOGTO_API_RESOURCE;

export async function GET() {
  if (!isLogtoConfigured) {
    return NextResponse.json({ token: null });
  }

  const cookieStore = await cookies();
  if (!cookieStore.has(LOGTO_COOKIE_KEY)) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  try {
    const { getLogtoContext } = await import("@logto/next/server-actions");

    const contextOptions: Record<string, unknown> = { getAccessToken: true };
    if (LOGTO_API_RESOURCE) {
      contextOptions.resource = LOGTO_API_RESOURCE;
    }

    const context = await getLogtoContext(logtoConfig, contextOptions);
    if (!context.isAuthenticated) {
      return NextResponse.json({ token: null }, { status: 401 });
    }

    const token = (context as Record<string, unknown>).accessToken;
    if (typeof token !== "string") {
      return NextResponse.json({ token: null }, { status: 204 });
    }

    const claims = (context.claims as Record<string, unknown>) ?? {};
    const subject = typeof claims.sub === "string" ? claims.sub : null;

    return NextResponse.json({ token, sub: subject });
  } catch (error) {
    console.error("[API] Failed to fetch Logto access token", error);
    return NextResponse.json({ token: null }, { status: 500 });
  }
}
