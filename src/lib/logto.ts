// ProConnect — Logto Configuration & Helpers
// Manages Logto SDK setup, getLogtoContext, sign-in/out actions

import type { LogtoNextConfig } from "@logto/next";
import type { AuthUser } from "@/types";
import { PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from "@/lib/rbac";

// ─── Role normalization helpers ───────────────────────────

function normalizeRoleToken(role: string): string {
  return role.trim().toLowerCase();
}

function splitRoleString(rawValue: string): string[] {
  // Split on commas only (not spaces) — role names like "Super Admin" must stay intact
  return rawValue
    .split(/,+/)
    .map((part) => normalizeRoleToken(part).replace(/[\s-]+/g, "_"))
    .filter(Boolean);
}

function addRoleValue(value: unknown, bucket: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) addRoleValue(item, bucket);
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const candidate of [obj.name, obj.value, obj.role, obj.key, obj.id, obj.slug]) {
      addRoleValue(candidate, bucket);
    }
    return;
  }
  if (typeof value !== "string") return;
  for (const role of splitRoleString(value)) bucket.add(role);
}

function isLikelyRoleKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  return (
    k === "role" || k === "roles" || k === "organization_roles" ||
    k.endsWith(":role") || k.endsWith(":roles") ||
    k.endsWith("/role") || k.endsWith("/roles") ||
    k.endsWith("_role") || k.endsWith("_roles")
  );
}

function collectRolesFromClaims(value: unknown, bucket: Set<string>): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (isLikelyRoleKey(key)) addRoleValue(v, bucket);
    if (v && typeof v === "object") collectRolesFromClaims(v, bucket);
  }
}

function getNormalizedRoles(claims: Record<string, unknown>): string[] {
  const roleKeys = ["roles", "role", "urn:logto:roles", "urn:logto:organization_roles", "organization_roles"];
  const roleSet = new Set<string>();
  for (const key of roleKeys) addRoleValue(claims[key], roleSet);
  collectRolesFromClaims(claims, roleSet);
  return [...roleSet];
}

function hasAdminRole(roles: string[]): boolean {
  return roles.some((r) => r === "admin" || r === "administrator" || r.includes("admin"));
}

function hasSuperAdminRole(roles: string[]): boolean {
  return roles.some((r) => {
    const n = r.replace(/[\s-]+/g, "_");
    return n === "super_admin" || n === "superadmin" ||
      n.endsWith(":super_admin") || n.endsWith(":superadmin") ||
      n.endsWith("/super_admin") || n.endsWith("/superadmin") ||
      (n.includes("super") && n.includes("admin"));
  });
}

// ─── JWT payload decoder (no verification — token is already trusted from SDK) ─
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const [, payload] = token.split(".");
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return {};
  }
}

// ─── Extract permissions from an access token's `scope` claim ─
function extractPermissionsFromToken(accessToken: string): string[] {
  const payload = decodeJwtPayload(accessToken);
  const scope = payload.scope;
  if (typeof scope !== "string") return [];
  return scope.split(/\s+/).filter(Boolean);
}


// ─── Feature flag: is Logto configured? ───────────────────
export const isLogtoConfigured =
  !!process.env.LOGTO_ENDPOINT && !!process.env.LOGTO_APP_ID;

// ─── Optional API Resource for permission-based RBAC ──────
const LOGTO_API_RESOURCE = process.env.LOGTO_API_RESOURCE || "";
const LOGTO_STRICT_SCOPES = process.env.LOGTO_STRICT_SCOPES !== "false";
const LOGTO_PERMISSION_SCOPES = Array.from(new Set(Object.values(PERMISSIONS)));

// ─── Logto SDK config ─────────────────────────────────────
export const logtoConfig: LogtoNextConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || "https://placeholder.logto.app",
  appId: process.env.LOGTO_APP_ID || "placeholder",
  appSecret: process.env.LOGTO_APP_SECRET || "",
  cookieSecret: process.env.LOGTO_COOKIE_SECRET || "dev-cookie-secret-at-least-32-characters-long!!",
  cookieSecure: (process.env.LOGTO_BASE_URL || "").startsWith("https://"),
  baseUrl: process.env.LOGTO_BASE_URL || "http://localhost:3001",
  scopes: ["openid", "profile", "email", "roles", ...LOGTO_PERMISSION_SCOPES],
  // Register API resource so the SDK can request access tokens for it
  ...(LOGTO_API_RESOURCE ? { resources: [LOGTO_API_RESOURCE] } : {}),
};

// ─── Dev bypass mock user ─────────────────────────────────
const DEV_USER: AuthUser = {
  sub: "dev-user-001",
  name: "John Doe",
  email: "john.doe@mortgagepros.com",
  avatar: undefined,
  role: "SUPER_ADMIN",
  permissions: ROLE_DEFAULT_PERMISSIONS.SUPER_ADMIN,
};

// ─── Cookie key used by @logto/next ───────────────────────
export const LOGTO_COOKIE_KEY = `logto_${logtoConfig.appId}`;

export interface AuthScopeDebugInfo {
  isLogtoConfigured: boolean;
  apiResourceConfigured: boolean;
  strictScopes: boolean;
  hasAccessToken: boolean;
  rawScope: string;
  tokenPermissions: string[];
  adminPermissionsFromToken: string[];
  resolvedRole: AuthUser["role"];
  effectivePermissions: string[];
  usedRoleFallback: boolean;
}

export async function getAuthScopeDebugInfo(): Promise<AuthScopeDebugInfo> {
  if (!isLogtoConfigured) {
    return {
      isLogtoConfigured: false,
      apiResourceConfigured: Boolean(LOGTO_API_RESOURCE),
      strictScopes: LOGTO_STRICT_SCOPES,
      hasAccessToken: false,
      rawScope: "",
      tokenPermissions: [],
      adminPermissionsFromToken: [],
      resolvedRole: "SUPER_ADMIN",
      effectivePermissions: [...ROLE_DEFAULT_PERMISSIONS.SUPER_ADMIN],
      usedRoleFallback: true,
    };
  }

  const { getLogtoContext } = await import("@logto/next/server-actions");

  const context = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  const claims = (context.claims as Record<string, unknown>) ?? {};
  const userInfo = (context.userInfo as Record<string, unknown>) ?? {};
  const info: Record<string, unknown> = {
    ...claims,
    ...userInfo,
  };

  const normalizedRoles = getNormalizedRoles(info);
  const isSuperAdmin = hasSuperAdminRole(normalizedRoles);
  const isAdmin = hasAdminRole(normalizedRoles);
  const role: AuthUser["role"] = isSuperAdmin ? "SUPER_ADMIN" : isAdmin ? "ADMIN" : "EMPLOYEE";

  let accessToken: string | undefined;
  if (LOGTO_API_RESOURCE) {
    try {
      const { getAccessToken } = await import("@logto/next/server-actions");
      accessToken = await getAccessToken(logtoConfig, LOGTO_API_RESOURCE);
    } catch {
      try {
        const { getAccessTokenRSC } = await import("@logto/next/server-actions");
        accessToken = await getAccessTokenRSC(logtoConfig, LOGTO_API_RESOURCE);
      } catch {
        // Could not get token
      }
    }
  }

  const payload = accessToken ? decodeJwtPayload(accessToken) : {};
  const rawScope = typeof payload.scope === "string" ? payload.scope : "";
  const tokenPerms = accessToken ? extractPermissionsFromToken(accessToken) : [];
  const adminPerms = tokenPerms.filter(
    (permission) => permission.startsWith("manage:")
  );

  let effectivePermissions: string[] = [];
  let usedRoleFallback = false;

  if (LOGTO_API_RESOURCE && accessToken) {
    effectivePermissions = adminPerms;
    usedRoleFallback = false;
  } else {
    usedRoleFallback = true;
    effectivePermissions = [...ROLE_DEFAULT_PERMISSIONS[role]];
  }

  return {
    isLogtoConfigured: true,
    apiResourceConfigured: Boolean(LOGTO_API_RESOURCE),
    strictScopes: LOGTO_STRICT_SCOPES,
    hasAccessToken: Boolean(accessToken),
    rawScope,
    tokenPermissions: tokenPerms,
    adminPermissionsFromToken: adminPerms,
    resolvedRole: role,
    effectivePermissions,
    usedRoleFallback,
  };
}

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

  // fetchUserInfo: true → calls Logto /oidc/userinfo on every request
  // so role changes take effect immediately (no sign-out needed)
  const context = await getLogtoContext(logtoConfig, { fetchUserInfo: true });

  if (!context.isAuthenticated) {
    return { isAuthenticated: false, user: null };
  }

  // Prefer userInfo (fresh from server) over cached claims
  const claims = (context.claims as Record<string, unknown>) ?? {};
  const userInfo = (context.userInfo as Record<string, unknown>) ?? {};
  const info: Record<string, unknown> = {
    ...claims,
    ...userInfo,
  };

  // Extract role from claims/userInfo
  const normalizedRoles = getNormalizedRoles(info);
  const isSuperAdmin = hasSuperAdminRole(normalizedRoles);
  const isAdmin = hasAdminRole(normalizedRoles);
  const role: AuthUser["role"] = isSuperAdmin ? "SUPER_ADMIN" : isAdmin ? "ADMIN" : "EMPLOYEE";

  // ─── Resolve permissions ────────────────────────────────
  let permissions: string[];

  if (LOGTO_API_RESOURCE) {
    // API Resource IS configured → token scopes are the source of truth.
    // Use getAccessToken server action (handles refresh automatically).
    let accessToken: string | undefined;
    try {
      const { getAccessToken } = await import("@logto/next/server-actions");
      accessToken = await getAccessToken(logtoConfig, LOGTO_API_RESOURCE);
    } catch {
      // If server action fails (e.g. RSC context), try RSC variant
      try {
        const { getAccessTokenRSC } = await import("@logto/next/server-actions");
        accessToken = await getAccessTokenRSC(logtoConfig, LOGTO_API_RESOURCE);
      } catch {
        // Could not get token — will use fallback below
      }
    }

    if (accessToken) {
      // Extract scopes from the token — these are exactly what Logto grants
      // based on the user's role permissions. No merging with code defaults.
      const tokenPerms = extractPermissionsFromToken(accessToken);
      const adminPerms = tokenPerms.filter(
        (p) => p.startsWith("manage:")
      );
      permissions = adminPerms;

      console.log("[RBAC] Permissions from Logto token:", {
        sub: info.sub,
        role,
        tokenScopes: tokenPerms.length,
        adminPerms: adminPerms,
      });
    } else {
      // No access token available — the user hasn't been granted access to
      // the API resource, or token refresh failed.
      // Fall back to role defaults as a safety net.
      console.warn("[RBAC] No API resource token available, using role defaults", {
        sub: info.sub,
        role,
      });
      permissions = [...ROLE_DEFAULT_PERMISSIONS[role]];
    }
  } else {
    // No API resource configured — derive permissions purely from role
    permissions = [...ROLE_DEFAULT_PERMISSIONS[role]];
  }

  return {
    isAuthenticated: true,
    user: {
      sub: (info.sub as string) ?? "",
      name: (info.name as string) ?? (info.username as string) ?? "User",
      email: (info.email as string) ?? "",
      avatar: (info.picture as string) ?? undefined,
      role,
      permissions,
    },
  };
}
