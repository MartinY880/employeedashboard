import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { findUserByIdentity, getUserRoles, isM2MConfigured } from "@/lib/logto-management";

export async function GET(request: Request) {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.VIEW_AS_USER)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").trim();
    const limitRaw = Number(searchParams.get("limit") || "8");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 8;

    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const rows = await prisma.directorySnapshot.findMany({
      where: {
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { mail: { contains: query, mode: "insensitive" } },
          { userPrincipalName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        displayName: true,
        mail: true,
        userPrincipalName: true,
        jobTitle: true,
      },
      orderBy: { displayName: "asc" },
      take: limit * 3,
    });

    const seen = new Set<string>();
    const users: Array<{ name: string; email: string; jobTitle: string; logtoRoles: string[] }> = [];

    if (!isM2MConfigured) {
      return NextResponse.json({ users: [] });
    }

    for (const row of rows) {
      const email = row.mail || row.userPrincipalName || "";
      if (!email) continue;
      const key = `${row.displayName.toLowerCase()}|${email.toLowerCase()}`;
      if (seen.has(key)) continue;

      let logtoRoles: string[] = [];
      try {
        const logtoUser = await findUserByIdentity(email, row.displayName);
        if (!logtoUser) continue;
        const roles = await getUserRoles(logtoUser.id);
        logtoRoles = Array.from(new Set(
          roles
            .map((r) => r.name.trim().toLowerCase().replace(/[\s-]+/g, "_"))
            .filter(Boolean),
        ));
      } catch {
        // Ignore per-user lookup failures; keep search resilient.
        continue;
      }

      users.push({
        name: row.displayName,
        email,
        jobTitle: row.jobTitle || "",
        logtoRoles,
      });
      seen.add(key);

      if (users.length >= limit) break;
    }

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[Pipeline] View-as search error:", err);
    return NextResponse.json({ users: [] });
  }
}
