// ProConnect — Logto Configuration & Helpers
// Manages Logto SDK setup, getLogtoContext, sign-in/out actions

import type { LogtoNextConfig } from "@logto/next";
import type { AuthUser } from "@/types";

function getNormalizedRoles(claims: Record<string, unknown>): string[] {
  const roleKeys = [
    "roles",
    "role",
    "urn:logto:roles",
    "urn:logto:organization_roles",
    "organization_roles",
  ];

  const values: unknown[] = [];

  for (const key of roleKeys) {
    const value = claims[key];
    if (Array.isArray(value)) {
      values.push(...value);
    } else if (typeof value === "string") {
      values.push(value);
    }
  }

  return values
    .filter((value): value is string => typeof value === "string")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);
}

function hasAdminRole(roles: string[]): boolean {
  return roles.some((role) => {
    return (
      role === "admin" ||
      role === "administrator" ||
      role.endsWith(":admin") ||
      role.endsWith("/admin")
    );
  });
}

// ─── Feature flag: is Logto configured? ───────────────────
export const isLogtoConfigured =
  !!process.env.LOGTO_ENDPOINT && !!process.env.LOGTO_APP_ID;

// ─── Logto SDK config ─────────────────────────────────────
export const logtoConfig: LogtoNextConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || "https://placeholder.logto.app",
  appId: process.env.LOGTO_APP_ID || "placeholder",
  appSecret: process.env.LOGTO_APP_SECRET || "",
  cookieSecret: process.env.LOGTO_COOKIE_SECRET || "dev-cookie-secret-at-least-32-characters-long!!",
  cookieSecure: (process.env.LOGTO_BASE_URL || "").startsWith("https://"),
  baseUrl: process.env.LOGTO_BASE_URL || "http://localhost:3000",
  scopes: ["openid", "profile", "email", "roles"],
};

// ─── Dev bypass mock user ─────────────────────────────────
const DEV_USER: AuthUser = {
  sub: "dev-user-001",
  name: "John Doe",
  email: "john.doe@mortgagepros.com",
  avatar: undefined,
  role: "ADMIN",
};

// ─── Cookie key used by @logto/next ───────────────────────
export const LOGTO_COOKIE_KEY = `logto_${logtoConfig.appId}`;

// ─── Get authenticated user (with dev bypass) ─────────────
export async function getAuthUser(): Promise<{
  isAuthenticated: boolean;
  user: AuthUser | null;
}> {
  // Dev bypass when Logto is not configured
  if (!isLogtoConfigured) {
    return { isAuthenticated: true, user: DEV_USER };
  }

  const { getLogtoContext } = await import("@logto/next/server-actions");
  const context = await getLogtoContext(logtoConfig, { fetchUserInfo: false });

  if (!context.isAuthenticated || !context.claims) {
    return { isAuthenticated: false, user: null };
  }

  const claims = context.claims;

  // Extract role from Logto claims and map it to app role
  const normalizedRoles = getNormalizedRoles(claims as Record<string, unknown>);
  const isAdmin = hasAdminRole(normalizedRoles);

  return {
    isAuthenticated: true,
    user: {
      sub: claims.sub,
      name: claims.name ?? claims.username ?? "User",
      email: (claims as Record<string, unknown>)["email"] as string ?? "",
      avatar: claims.picture ?? undefined,
      role: isAdmin ? "ADMIN" : "EMPLOYEE",
    },
  };
}
