// ProConnect — Active Pipeline: View As User
// POST → Set impersonation: admin views dashboard as a specific user
// GET  → Check current impersonation state
// DELETE → Clear impersonation

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { findUserByIdentity, getUserRoles, isM2MConfigured } from "@/lib/logto-management";

const VIEW_AS_PREFIX = "pipeline_viewas_";
const AUTO_VIEW_AS_ENABLED_PREFIX = "pipeline_viewas_auto_enabled_";
const AUTO_VIEW_AS_NONCE_PREFIX = "pipeline_viewas_auto_nonce_";

interface ViewAsData {
  name: string;
  email: string;
  roles?: string[];
  setAt: string;
}

interface AutoViewAsEnabledData {
  enabled: boolean;
  updatedAt: string;
}

interface AutoViewAsNonceData {
  nonce: number;
  updatedAt: string;
}

/** POST — set impersonation for the current admin */
export async function POST(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.VIEW_AS_USER)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();

    if (!name && !email) {
      return NextResponse.json({ error: "name or email is required" }, { status: 400 });
    }

    // Resolve target person from directory (prefer exact email/name before fuzzy match).
    let snapshot = null as null | { displayName: string; mail: string | null; jobTitle: string | null; userPrincipalName: string };

    if (email) {
      snapshot = await prisma.directorySnapshot.findFirst({
        where: {
          OR: [
            { mail: { equals: email, mode: "insensitive" } },
            { userPrincipalName: { equals: email, mode: "insensitive" } },
          ],
        },
        select: { displayName: true, mail: true, jobTitle: true, userPrincipalName: true },
      });
    }

    if (!snapshot && name) {
      snapshot = await prisma.directorySnapshot.findFirst({
        where: { displayName: { equals: name, mode: "insensitive" } },
        select: { displayName: true, mail: true, jobTitle: true, userPrincipalName: true },
      });
    }

    if (!snapshot && name) {
      snapshot = await prisma.directorySnapshot.findFirst({
        where: { displayName: { contains: name, mode: "insensitive" } },
        orderBy: { displayName: "asc" },
        select: { displayName: true, mail: true, jobTitle: true, userPrincipalName: true },
      });
    }

    const resolvedName = snapshot?.displayName ?? name;
    const resolvedEmail = snapshot?.mail ?? snapshot?.userPrincipalName ?? email;

    if (!resolvedEmail) {
      return NextResponse.json({ error: "Unable to resolve user email for Logto role lookup" }, { status: 400 });
    }

    if (!isM2MConfigured) {
      return NextResponse.json({ error: "Logto M2M is not configured" }, { status: 500 });
    }

    const logtoUser = await findUserByIdentity(resolvedEmail, resolvedName);
    if (!logtoUser) {
      return NextResponse.json({ error: `User not found in Logto: ${resolvedEmail || resolvedName}` }, { status: 404 });
    }

    const logtoRoles = await getUserRoles(logtoUser.id);
    const resolvedRoles = Array.from(new Set(
      logtoRoles
        .map((r) => r.name.trim().toLowerCase().replace(/[\s-]+/g, "_"))
        .filter(Boolean),
    ));

    const viewAsId = `${VIEW_AS_PREFIX}${user.sub}`;
    const data: ViewAsData = {
      name: resolvedName,
      email: resolvedEmail,
      roles: resolvedRoles,
      setAt: new Date().toISOString(),
    };

    await prisma.calendarSetting.upsert({
      where: { id: viewAsId },
      create: { id: viewAsId, data: JSON.stringify(data) },
      update: { data: JSON.stringify(data) },
    });

    // Manual selection should disable auto-rotate until explicitly re-enabled.
    if (user.role === "SUPER_ADMIN") {
      const autoRotateId = `${AUTO_VIEW_AS_ENABLED_PREFIX}${user.sub}`;
      const autoRotateData: AutoViewAsEnabledData = {
        enabled: false,
        updatedAt: new Date().toISOString(),
      };
      await prisma.calendarSetting.upsert({
        where: { id: autoRotateId },
        create: { id: autoRotateId, data: JSON.stringify(autoRotateData) },
        update: { data: JSON.stringify(autoRotateData) },
      });
    }

    return NextResponse.json({ ok: true, viewingAs: data });
  } catch (err) {
    console.error("[Pipeline] View-as POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** GET — check current impersonation state */
export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const defaultAutoRotateEnabled = user.role === "SUPER_ADMIN";
    let autoRotateEnabled = defaultAutoRotateEnabled;

    const autoRotateId = `${AUTO_VIEW_AS_ENABLED_PREFIX}${user.sub}`;
    const autoRotateRow = await prisma.calendarSetting.findUnique({ where: { id: autoRotateId } });
    if (autoRotateRow?.data) {
      try {
        const parsed = JSON.parse(autoRotateRow.data) as AutoViewAsEnabledData;
        if (typeof parsed.enabled === "boolean") {
          autoRotateEnabled = parsed.enabled;
        }
      } catch {
        /* ignore invalid auto-rotate payload */
      }
    }

    const viewAsId = `${VIEW_AS_PREFIX}${user.sub}`;
    const row = await prisma.calendarSetting.findUnique({ where: { id: viewAsId } });

    if (!row?.data) {
      return NextResponse.json({ viewingAs: null, autoRotateEnabled });
    }

    try {
      const data: ViewAsData = JSON.parse(row.data);
      return NextResponse.json({ viewingAs: data, autoRotateEnabled });
    } catch {
      return NextResponse.json({ viewingAs: null, autoRotateEnabled });
    }
  } catch (err) {
    console.error("[Pipeline] View-as GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** PATCH — enable/disable automatic hourly super-admin preview rotation */
export async function PATCH(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.VIEW_AS_USER) || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
    }

    const autoRotateId = `${AUTO_VIEW_AS_ENABLED_PREFIX}${user.sub}`;
    const data: AutoViewAsEnabledData = {
      enabled: body.enabled,
      updatedAt: new Date().toISOString(),
    };

    await prisma.calendarSetting.upsert({
      where: { id: autoRotateId },
      create: { id: autoRotateId, data: JSON.stringify(data) },
      update: { data: JSON.stringify(data) },
    });

    // Re-enabling auto should immediately switch to auto preview mode.
    // Remove any pinned manual selection so dashboard GET falls back to auto identity.
    if (data.enabled) {
      const viewAsId = `${VIEW_AS_PREFIX}${user.sub}`;
      await prisma.calendarSetting.deleteMany({ where: { id: viewAsId } });
    }

    return NextResponse.json({ ok: true, autoRotateEnabled: data.enabled });
  } catch (err) {
    console.error("[Pipeline] View-as PATCH error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** PUT — force-refresh auto-rotated user (super admin only) */
export async function PUT() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.VIEW_AS_USER) || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nonceId = `${AUTO_VIEW_AS_NONCE_PREFIX}${user.sub}`;
    const existing = await prisma.calendarSetting.findUnique({ where: { id: nonceId } });

    let nextNonce = 1;
    if (existing?.data) {
      try {
        const parsed = JSON.parse(existing.data) as AutoViewAsNonceData;
        const current = Number.isFinite(parsed.nonce) ? parsed.nonce : 0;
        nextNonce = current + 1;
      } catch {
        nextNonce = 1;
      }
    }

    const payload: AutoViewAsNonceData = {
      nonce: nextNonce,
      updatedAt: new Date().toISOString(),
    };

    await prisma.calendarSetting.upsert({
      where: { id: nonceId },
      create: { id: nonceId, data: JSON.stringify(payload) },
      update: { data: JSON.stringify(payload) },
    });

    return NextResponse.json({ ok: true, refreshed: true });
  } catch (err) {
    console.error("[Pipeline] View-as PUT error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** DELETE — clear impersonation */
export async function DELETE() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.VIEW_AS_USER)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const viewAsId = `${VIEW_AS_PREFIX}${user.sub}`;
    await prisma.calendarSetting.deleteMany({ where: { id: viewAsId } });

    return NextResponse.json({ ok: true, viewingAs: null });
  } catch (err) {
    console.error("[Pipeline] View-as DELETE error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
