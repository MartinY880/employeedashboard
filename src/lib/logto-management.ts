// ProConnect — Logto Management API Client
// Uses M2M app credentials to manage user roles via the Logto Management API.

import "server-only";
import { prisma } from "@/lib/prisma";

const LOGTO_ENDPOINT = process.env.LOGTO_ENDPOINT || "";
const M2M_APP_ID = process.env.LOGTO_M2M_APP_ID || "";
const M2M_APP_SECRET = process.env.LOGTO_M2M_APP_SECRET || "";

// The Logto Management API resource identifier (built-in default for all Logto instances)
const MANAGEMENT_API_RESOURCE = "https://default.logto.app/api";

export const isM2MConfigured =
  !!LOGTO_ENDPOINT && !!M2M_APP_ID && !!M2M_APP_SECRET;

// ─── Token cache ──────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

/** Get an M2M access token for the Logto Management API */
async function getManagementToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${LOGTO_ENDPOINT}/oidc/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${M2M_APP_ID}:${M2M_APP_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      resource: MANAGEMENT_API_RESOURCE,
      scope: "all",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get M2M token: ${res.status} ${body}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return cachedToken.token;
}

/** Helper: make an authenticated request to the Logto Management API */
async function mgmtFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getManagementToken();
  return fetch(`${LOGTO_ENDPOINT}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

// ─── Role helpers ─────────────────────────────────────────

interface LogtoRole {
  id: string;
  name: string;
  description?: string;
}

interface LogtoUser {
  id: string;
  primaryEmail: string | null;
  name: string | null;
  username: string | null;
}

/** List all roles defined in Logto */
export async function listRoles(): Promise<LogtoRole[]> {
  const res = await mgmtFetch("/roles?page=1&page_size=100");
  if (!res.ok) throw new Error(`Failed to list roles: ${res.status}`);
  return res.json();
}

/** Find a Logto user by email */
export async function findUserByEmail(email: string): Promise<LogtoUser | null> {
  // Logto v1 Management API: use %23 for exact match, or simple search
  const res = await mgmtFetch(`/users?search=%25${encodeURIComponent(email)}%25&page=1&page_size=20`);
  if (!res.ok) {
    // Try alternative search syntax
    const res2 = await mgmtFetch(`/users?search=${encodeURIComponent(email)}`);
    if (!res2.ok) throw new Error(`Failed to search users: ${res.status} / ${res2.status}`);
    const users2: LogtoUser[] = await res2.json();
    return users2.find((u) => u.primaryEmail?.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const users: LogtoUser[] = await res.json();
  // Exact match on primary email
  return users.find((u) => u.primaryEmail?.toLowerCase() === email.toLowerCase()) ?? null;
}

/** Find a Logto user by email first, then by exact name/username as fallback. */
export async function findUserByIdentity(
  email: string | null | undefined,
  name: string | null | undefined,
): Promise<LogtoUser | null> {
  const normalizedEmail = (email || "").trim().toLowerCase();
  const normalizedName = (name || "").trim().toLowerCase();

  if (normalizedEmail) {
    const byEmail = await findUserByEmail(normalizedEmail);
    if (byEmail) return byEmail;
  }

  if (!normalizedName) return null;

  // Fallback search by display name / username.
  const res = await mgmtFetch(`/users?search=${encodeURIComponent(normalizedName)}&page=1&page_size=50`);
  if (!res.ok) {
    throw new Error(`Failed to search users by identity: ${res.status}`);
  }

  const users: LogtoUser[] = await res.json();

  // Prefer an exact name/username hit.
  const exact = users.find((u) =>
    (u.name?.toLowerCase() === normalizedName) || (u.username?.toLowerCase() === normalizedName),
  );
  if (exact) return exact;

  // If no exact match, return a case-insensitive contains match as last resort.
  const partial = users.find((u) =>
    (u.name?.toLowerCase().includes(normalizedName)) ||
    (u.username?.toLowerCase().includes(normalizedName)) ||
    (u.primaryEmail?.toLowerCase().includes(normalizedName)),
  );
  return partial ?? null;
}

/** Get the roles currently assigned to a Logto user */
export async function getUserRoles(userId: string): Promise<LogtoRole[]> {
  const res = await mgmtFetch(`/users/${userId}/roles`);
  if (!res.ok) throw new Error(`Failed to get user roles: ${res.status}`);
  return res.json();
}

/** Count the users currently assigned to a Logto role. */
export async function getRoleUserCount(roleId: string): Promise<number> {
  const pageSize = 100;
  let page = 1;
  let total = 0;

  while (true) {
    const res = await mgmtFetch(`/roles/${roleId}/users?page=${page}&page_size=${pageSize}`);
    if (!res.ok) throw new Error(`Failed to get users for role ${roleId}: ${res.status}`);

    const users: LogtoUser[] = await res.json();
    total += users.length;

    if (users.length < pageSize) break;
    page += 1;
  }

  return total;
}

/** Assign roles to a Logto user (by role IDs) */
export async function assignRoles(userId: string, roleIds: string[]): Promise<void> {
  if (roleIds.length === 0) return;
  const res = await mgmtFetch(`/users/${userId}/roles`, {
    method: "POST",
    body: JSON.stringify({ roleIds }),
  });
  if (!res.ok && res.status !== 409) {
    // 409 = role already assigned, which is fine
    throw new Error(`Failed to assign roles: ${res.status}`);
  }
}

/** Remove roles from a Logto user (by role IDs) */
export async function removeRoles(userId: string, roleIds: string[]): Promise<void> {
  if (roleIds.length === 0) return;
  for (const roleId of roleIds) {
    const res = await mgmtFetch(`/users/${userId}/roles/${roleId}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to remove role ${roleId}: ${res.status}`);
    }
  }
}

// ─── Job title → Logto role mapping ──────────────────────

/** Map a directory job title to the desired Logto role name.
 *  Reads from the role_mappings table (case-insensitive exact match).
 *  Falls back to "Employee" when no mapping matches. */
export async function resolveJobTitleRoleTarget(
  jobTitle: string | null | undefined,
): Promise<{ roleName: string; isExplicitMapping: boolean }> {
  if (!jobTitle) return { roleName: "Employee", isExplicitMapping: false };
  const t = jobTitle.replace(/\s+/g, " ").trim();
  if (!t) return { roleName: "Employee", isExplicitMapping: false };

  // Look for an exact match first (case-insensitive)
  const exactMatch = await prisma.roleMapping.findFirst({
    where: { jobTitle: { equals: t, mode: "insensitive" } },
  });
  if (exactMatch) {
    return { roleName: exactMatch.logtoRoleName, isExplicitMapping: true };
  }

  // Fallback exact match with normalized spaces on DB values.
  // This preserves exact semantics while ignoring extra internal whitespace.
  const allMappings = await prisma.roleMapping.findMany({
    select: { jobTitle: true, logtoRoleName: true },
  });
  const normalizedInput = t.toLowerCase();
  for (const mapping of allMappings) {
    const normalizedMappingTitle = mapping.jobTitle.replace(/\s+/g, " ").trim().toLowerCase();
    if (normalizedMappingTitle === normalizedInput) {
      return { roleName: mapping.logtoRoleName, isExplicitMapping: true };
    }
  }

  return { roleName: "Employee", isExplicitMapping: false };
}

export async function mapJobTitleToRoleName(jobTitle: string | null | undefined): Promise<string> {
  const target = await resolveJobTitleRoleTarget(jobTitle);
  return target.roleName;
}

/**
 * Update the DB users table role to match the Logto role.
 * Only roles containing "admin" map to DB "ADMIN"; everything else is "EMPLOYEE".
 */
async function syncDbUserRole(email: string, logtoRoleName: string) {
  const lower = logtoRoleName.toLowerCase();
  const dbRole = (lower.includes("admin")) ? "ADMIN" : "EMPLOYEE";
  await prisma.user.updateMany({
    where: { email: { equals: email, mode: "insensitive" } },
    data: { role: dbRole },
  });
}

/**
 * Sync a single user's Logto role based on their directory job title.
 * Returns a summary of what changed.
 */
export async function syncUserRole(
  email: string,
  jobTitle: string | null | undefined,
): Promise<{ email: string; status: string; detail?: string }> {
  try {
    // Check if this user is excluded from role mapping
    const exclusion = await prisma.roleMappingExclusion.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (exclusion) {
      return { email, status: "skipped", detail: "Excluded from role mapping" };
    }

    const target = await resolveJobTitleRoleTarget(jobTitle);
    const targetRoleName = target.roleName;

    // Find the user in Logto
    const logtoUser = await findUserByEmail(email);
    if (!logtoUser) {
      return { email, status: "skipped", detail: "User not found in Logto" };
    }

    // Get all available roles and find the target
    const allRoles = await listRoles();
    const targetRole = allRoles.find(
      (r) => r.name.toLowerCase() === targetRoleName.toLowerCase(),
    );
    if (!targetRole) {
      return { email, status: "error", detail: `Role "${targetRoleName}" not found in Logto` };
    }

    // Get current roles
    const currentRoles = await getUserRoles(logtoUser.id);
    const hasTarget = currentRoles.some((r) => r.id === targetRole.id);

    if (hasTarget) {
      // Logto role is correct — make sure the DB matches
      await syncDbUserRole(email, targetRoleName);
      return { email, status: "unchanged", detail: `Already has "${targetRoleName}"` };
    }

    // If the mapping resolves to "Employee" (no explicit mapping exists),
    // only upgrade from Employee — don't touch users with other roles.
    // If an explicit mapping exists (non-Employee target), always apply it
    // so role changes follow title changes.
    const nonEmployeeRole = currentRoles.find(
      (r) => r.name.toLowerCase() !== "employee",
    );

    if (!target.isExplicitMapping && nonEmployeeRole) {
      return {
        email,
        status: "skipped",
        detail: `No mapping for title — keeping current role "${nonEmployeeRole.name}"`,
      };
    }

    // Safe to assign: either the user is Employee, or an explicit mapping exists
    const rolesToRemove = currentRoles.map((r) => r.id);

    await removeRoles(logtoUser.id, rolesToRemove);
    await assignRoles(logtoUser.id, [targetRole.id]);

    // Keep the DB users table in sync with the Logto role change
    await syncDbUserRole(email, targetRoleName);

    return {
      email,
      status: "updated",
      detail: `${currentRoles.map((r) => r.name).join(", ") || "(none)"} → ${targetRoleName}`,
    };
  } catch (err) {
    return { email, status: "error", detail: String(err) };
  }
}
