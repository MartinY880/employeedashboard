// ProConnect — Logto OIDC Callback (Route Handler)
// Must be a route handler (not a page) so handleSignIn can set cookies

import { handleSignIn, getLogtoContext } from "@logto/next/server-actions";
import { isLogtoConfigured, logtoConfig } from "@/lib/logto";
import { ensureDbUser, prisma } from "@/lib/prisma";
import {
  isM2MConfigured,
  syncUserRole,
  resolveJobTitleRoleTarget,
} from "@/lib/logto-management";
import { NextRequest, NextResponse } from "next/server";

// ─── Role helpers (mirror logto.ts logic) ─────────────────
function normalizeRoleToken(role: string): string {
  return role.trim().toLowerCase();
}

function splitRoleString(rawValue: string): string[] {
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

function resolveDbRole(claims: Record<string, unknown>): "ADMIN" | "EMPLOYEE" {
  const roleKeys = ["roles", "role", "urn:logto:roles", "urn:logto:organization_roles", "organization_roles"];
  const roleSet = new Set<string>();
  for (const key of roleKeys) addRoleValue(claims[key], roleSet);
  const roles = [...roleSet];
  // Only Logto roles containing "admin" map to DB ADMIN
  const isAdmin = roles.some((r) => r.includes("admin"));
  return isAdmin ? "ADMIN" : "EMPLOYEE";
}

export async function GET(request: NextRequest) {
  // Debug helper
  const fs = await import("fs");
  const dbg = (msg: string) => fs.appendFileSync("/tmp/callback-debug.log", `[${new Date().toISOString()}] ${msg}\n`);
  dbg("Callback hit");

  if (!isLogtoConfigured) {
    return NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
  }

  try {
    await handleSignIn(logtoConfig, request.nextUrl.searchParams);

    // Create or update the User row from Logto identity on every login
    try {
      dbg("Starting user sync...");
      const context = await getLogtoContext(logtoConfig, {
        fetchUserInfo: true,
      });
      dbg(`isAuthenticated: ${context.isAuthenticated}`);

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
          const dbRole = resolveDbRole(info);
          await ensureDbUser(sub, email, name, dbRole);

          // ── Auto-sync role from directory job title via Logto Management API ──
          dbg(`M2M configured: ${isM2MConfigured}, email: ${email}`);
          if (isM2MConfigured) {
            try {
              const snapshot = await prisma.directorySnapshot.findFirst({
                where: { mail: { equals: email, mode: "insensitive" } },
                select: { jobTitle: true },
              });

              if (snapshot?.jobTitle) {
                const target = await resolveJobTitleRoleTarget(snapshot.jobTitle);
                // Sync when a non-Employee role is targeted, or when
                // Employee is explicitly mapped for this title.
                if (target.roleName.toLowerCase() !== "employee" || target.isExplicitMapping) {
                  const result = await syncUserRole(email, snapshot.jobTitle);
                  dbg(`Role sync result: ${JSON.stringify(result)}`);
                  // syncUserRole now automatically updates the DB users table
                }
              }
            } catch (err) {
              console.warn("[Auth Callback] Directory role sync failed:", err);
            }
          }
        }
      }
    } catch (err) {
      // Non-fatal — user record will be created on next API call if this fails
      console.warn("[Auth Callback] Failed to sync user on login:", err);
      dbg(`ERROR: ${err}`);
    }

    const redirectResponse = NextResponse.redirect(new URL("/dashboard", logtoConfig.baseUrl));
    // Set the session epoch so the middleware force-logout check passes
    redirectResponse.cookies.set("session_epoch", "2", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return redirectResponse;
  } catch (error) {
    console.error("[ProConnect] Auth callback failed:", error);

    return NextResponse.redirect(new URL("/sign-in", logtoConfig.baseUrl));
  }
}
