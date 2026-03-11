import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { LOGTO_COOKIE_KEY, isLogtoConfigured, logtoConfig } from "@/lib/logto";

// Must be explicitly set — falling back to a default causes Logto to reject
// the auth request with 400 when the resource isn't registered, returning 401.
const DJ_API_RESOURCE = process.env.LOGTO_DJ_APP_RESOURCE;

export async function GET() {
  if (!isLogtoConfigured || !DJ_API_RESOURCE) {
    return NextResponse.json({ token: null });
  }

  const cookieStore = await cookies();
  if (!cookieStore.has(LOGTO_COOKIE_KEY)) {
    return NextResponse.json({ token: null });
  }

  try {
    const { getLogtoContext } = await import("@logto/next/server-actions");

    // Verify the session using a config WITHOUT the DJ resource, so that
    // existing sessions (created before the DJ resource was added) are not
    // incorrectly marked as unauthenticated by the SDK's resource validation.
    const sessionConfig = {
      ...logtoConfig,
      resources: (logtoConfig.resources ?? []).filter((r) => r !== DJ_API_RESOURCE),
    };
    const session = await getLogtoContext(sessionConfig, {});
    if (!session.isAuthenticated) {
      return NextResponse.json({ token: null });
    }

    // Now attempt the DJ-scoped token — failures here are non-fatal.
    const djContext = await getLogtoContext(logtoConfig, {
      getAccessToken: true,
      resource: DJ_API_RESOURCE,
    });

    const token = (djContext as Record<string, unknown>).accessToken;
    if (typeof token !== "string") {
      return NextResponse.json({ token: null });
    }

    const claims = (session.claims as Record<string, unknown>) ?? {};
    const userId = typeof claims.sub === "string" ? claims.sub : null;
    const displayName = typeof claims.name === "string" ? claims.name : null;

    return NextResponse.json({ token, userId, displayName });
  } catch (error) {
    // DJ token unavailable (resource not registered, grant not issued, etc.)
    // Return null gracefully — iframe loads without auth rather than erroring.
    console.error("[API] DJ token fetch failed", error);
    return NextResponse.json({ token: null });
  }
}
