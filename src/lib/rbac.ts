import type { AuthUser } from "@/types";

export type AppRole = AuthUser["role"];

// ─── Permission constants (match what you define in Logto API Resource) ───
export const PERMISSIONS = {
  MANAGE_ALERTS: "manage:alerts",
  MANAGE_TOURNAMENT: "manage:tournament",
  MANAGE_BRANDING: "manage:branding",
  MANAGE_SLIDER: "manage:slider",
  MANAGE_PROPS: "manage:props",
  MANAGE_PILLARS: "manage:pillars",
  MANAGE_IDEAS: "manage:ideas",
  MANAGE_QUICKLINKS: "manage:quicklinks",
  MANAGE_RESOURCES: "manage:resources",
  MANAGE_HIGHLIGHTS: "manage:highlights",
  MANAGE_MYSHARE_FEED: "manage:highlight_feed",
  MANAGE_CALENDAR: "manage:calendar",
  MANAGE_VIDEO_SPOTLIGHT: "manage:video_spotlight",
  MANAGE_VENDORS: "manage:vendors",
  MANAGE_IMPORTANT_DATES: "manage:important_dates",
  MANAGE_LENDER_ACCOUNT_EXECUTIVES: "manage:lender_account_executives",
  MANAGE_CLOSERS_TABLE: "manage:closers_table",
  MANAGE_CELEBRATIONS: "manage:celebrations",
  MANAGE_ROLE_MAPPINGS: "manage:role_mappings",
  MANAGE_SALESFORCE_REPORT: "manage:salesforce_report",
  MANAGE_ACTIVE_PIPELINE: "manage:active_pipeline",
  VIEW_AS_USER: "view:as_user",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// All known permissions
const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

// ─── Route → required permission mapping ──────────────────
export const ROUTE_PERMISSION: Record<string, Permission> = {
  "/admin/alerts": PERMISSIONS.MANAGE_ALERTS,
  "/admin/tournament": PERMISSIONS.MANAGE_TOURNAMENT,
  "/admin/branding": PERMISSIONS.MANAGE_BRANDING,
  "/admin/slider": PERMISSIONS.MANAGE_SLIDER,
  "/admin/props": PERMISSIONS.MANAGE_PROPS,
  "/admin/pillars": PERMISSIONS.MANAGE_PILLARS,
  "/admin/ideas": PERMISSIONS.MANAGE_IDEAS,
  "/admin/quicklinks": PERMISSIONS.MANAGE_QUICKLINKS,
  "/admin/resources": PERMISSIONS.MANAGE_RESOURCES,
  "/admin/highlights": PERMISSIONS.MANAGE_HIGHLIGHTS,
  "/admin/myshare-feed": PERMISSIONS.MANAGE_MYSHARE_FEED,
  "/admin/calendar": PERMISSIONS.MANAGE_CALENDAR,
  "/admin/video-spotlight": PERMISSIONS.MANAGE_VIDEO_SPOTLIGHT,
  "/admin/preferred-vendors": PERMISSIONS.MANAGE_VENDORS,
  "/admin/important-dates": PERMISSIONS.MANAGE_IMPORTANT_DATES,
  "/admin/lender-account-executives": PERMISSIONS.MANAGE_LENDER_ACCOUNT_EXECUTIVES,
  "/admin/closers-table": PERMISSIONS.MANAGE_CLOSERS_TABLE,
  "/admin/celebrations": PERMISSIONS.MANAGE_CELEBRATIONS,
  "/admin/role-mappings": PERMISSIONS.MANAGE_ROLE_MAPPINGS,
  "/admin/salesforce-report": PERMISSIONS.MANAGE_SALESFORCE_REPORT,
  "/admin/active-pipeline": PERMISSIONS.MANAGE_ACTIVE_PIPELINE,
};

// ─── Fallback: derive permissions from role when Logto API Resource isn't configured ───
export const ROLE_DEFAULT_PERMISSIONS: Record<AppRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ADMIN: [
    PERMISSIONS.MANAGE_ALERTS,
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
  return ALL_PERMISSIONS.some((permission) => user.permissions.includes(permission));
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
