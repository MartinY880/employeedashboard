import type { AuthUser } from "@/types";

export type AppRole = AuthUser["role"];

// ─── Permission constants (match what you define in Logto API Resource) ───
export const PERMISSIONS = {
  MANAGE_ALERTS: "manage:alerts",
  MANAGE_TOURNAMENT: "manage:tournament",
  MANAGE_BRANDING: "manage:branding",
  MANAGE_KUDOS: "manage:kudos",
  MANAGE_PILLARS: "manage:pillars",
  MANAGE_IDEAS: "manage:ideas",
  MANAGE_QUICKLINKS: "manage:quicklinks",
  MANAGE_HIGHLIGHTS: "manage:highlights",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// All known permissions
const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// ─── Route → required permission mapping ──────────────────
export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/admin/alerts": PERMISSIONS.MANAGE_ALERTS,
  "/admin/tournament": PERMISSIONS.MANAGE_TOURNAMENT,
  "/admin/branding": PERMISSIONS.MANAGE_BRANDING,
  "/admin/kudos": PERMISSIONS.MANAGE_KUDOS,
  "/admin/pillars": PERMISSIONS.MANAGE_PILLARS,
  "/admin/ideas": PERMISSIONS.MANAGE_IDEAS,
  "/admin/quicklinks": PERMISSIONS.MANAGE_QUICKLINKS,
  "/admin/highlights": PERMISSIONS.MANAGE_HIGHLIGHTS,
};

// ─── Fallback: derive permissions from role when Logto API Resource isn't configured ───
export const ROLE_DEFAULT_PERMISSIONS: Record<AppRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: [PERMISSIONS.MANAGE_ALERTS, PERMISSIONS.MANAGE_TOURNAMENT],
  EMPLOYEE: [],
};

// ─── Permission check helpers ─────────────────────────────

/** Does the user have a specific permission? */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/** Does the user have ANY admin-level permission (i.e. can see Admin Panel)? */
export function hasAnyAdminPermission(user: AuthUser): boolean {
  return ALL_PERMISSIONS.some((p) => user.permissions.includes(p));
}

// ─── Legacy role helpers (kept for backward compatibility) ─
export function isSuperAdminRole(role: AppRole): boolean {
  return role === "SUPER_ADMIN";
}

export function isAdminRole(role: AppRole): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function toDbRole(role: AppRole): "ADMIN" | "EMPLOYEE" {
  return role === "EMPLOYEE" ? "EMPLOYEE" : "ADMIN";
}
