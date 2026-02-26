import type { AuthUser } from "@/types";

export type AppRole = AuthUser["role"];

// ─── Permission constants (match what you define in Logto API Resource) ───
export const PERMISSIONS = {
  VIEW_ALERTS: "view:alerts",
  MANAGE_ALERTS: "manage:alerts",
  VIEW_TOURNAMENT: "view:tournament",
  MANAGE_TOURNAMENT: "manage:tournament",
  VIEW_BRANDING: "view:branding",
  MANAGE_BRANDING: "manage:branding",
  VIEW_KUDOS: "view:kudos",
  MANAGE_KUDOS: "manage:kudos",
  VIEW_PILLARS: "view:pillars",
  MANAGE_PILLARS: "manage:pillars",
  VIEW_IDEAS: "view:ideas",
  MANAGE_IDEAS: "manage:ideas",
  VIEW_QUICKLINKS: "view:quicklinks",
  MANAGE_QUICKLINKS: "manage:quicklinks",
  VIEW_RESOURCES: "view:resources",
  MANAGE_RESOURCES: "manage:resources",
  VIEW_HIGHLIGHTS: "view:highlights",
  MANAGE_HIGHLIGHTS: "manage:highlights",
  VIEW_CALENDAR: "view:calendar",
  MANAGE_CALENDAR: "manage:calendar",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// All known permissions
const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// ─── Route → required permission mapping ──────────────────
export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/admin/alerts": PERMISSIONS.MANAGE_ALERTS,
  "/admin/tournament": PERMISSIONS.MANAGE_TOURNAMENT,
  "/admin/branding": PERMISSIONS.MANAGE_BRANDING,
  "/admin/slider": PERMISSIONS.MANAGE_BRANDING,
  "/admin/kudos": PERMISSIONS.MANAGE_KUDOS,
  "/admin/pillars": PERMISSIONS.MANAGE_PILLARS,
  "/admin/ideas": PERMISSIONS.MANAGE_IDEAS,
  "/admin/quicklinks": PERMISSIONS.MANAGE_QUICKLINKS,
  "/admin/resources": PERMISSIONS.MANAGE_RESOURCES,
  "/admin/highlights": PERMISSIONS.MANAGE_HIGHLIGHTS,
  "/admin/calendar": PERMISSIONS.MANAGE_CALENDAR,
};

export const VIEW_TO_MANAGE_PERMISSION: Partial<Record<Permission, Permission>> = {
  [PERMISSIONS.VIEW_ALERTS]: PERMISSIONS.MANAGE_ALERTS,
  [PERMISSIONS.VIEW_TOURNAMENT]: PERMISSIONS.MANAGE_TOURNAMENT,
  [PERMISSIONS.VIEW_BRANDING]: PERMISSIONS.MANAGE_BRANDING,
  [PERMISSIONS.VIEW_KUDOS]: PERMISSIONS.MANAGE_KUDOS,
  [PERMISSIONS.VIEW_PILLARS]: PERMISSIONS.MANAGE_PILLARS,
  [PERMISSIONS.VIEW_IDEAS]: PERMISSIONS.MANAGE_IDEAS,
  [PERMISSIONS.VIEW_QUICKLINKS]: PERMISSIONS.MANAGE_QUICKLINKS,
  [PERMISSIONS.VIEW_RESOURCES]: PERMISSIONS.MANAGE_RESOURCES,
  [PERMISSIONS.VIEW_HIGHLIGHTS]: PERMISSIONS.MANAGE_HIGHLIGHTS,
  [PERMISSIONS.VIEW_CALENDAR]: PERMISSIONS.MANAGE_CALENDAR,
};

// ─── Fallback: derive permissions from role when Logto API Resource isn't configured ───
export const ROLE_DEFAULT_PERMISSIONS: Record<AppRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: [
    PERMISSIONS.VIEW_ALERTS,
    PERMISSIONS.MANAGE_ALERTS,
    PERMISSIONS.VIEW_TOURNAMENT,
    PERMISSIONS.MANAGE_TOURNAMENT,
  ],
  EMPLOYEE: [],
};

// ─── Permission check helpers ─────────────────────────────

/** Does the user have a specific permission? */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/** Does the user have ANY admin-level permission (i.e. can see Admin Panel)? */
export function hasAnyAdminPermission(user: AuthUser): boolean {
  return ALL_PERMISSIONS
    .filter((permission) => permission.startsWith("manage:"))
    .some((permission) => user.permissions.includes(permission));
}

/** Does the user have view access for an admin section (view OR manage)? */
export function hasViewOrManagePermission(
  user: AuthUser,
  viewPermission: Permission
): boolean {
  if (hasPermission(user, viewPermission)) return true;
  const managePermission = VIEW_TO_MANAGE_PERMISSION[viewPermission];
  return !!managePermission && hasPermission(user, managePermission);
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
