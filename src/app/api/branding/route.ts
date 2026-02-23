// ProConnect — Branding API Route
// GET: Fetch current site branding | POST: Update branding (admin only)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

// In-memory branding for demo mode
const demoBranding = {
  id: "singleton",
  companyName: "MortgagePros",
  logoData: null as string | null,
  faviconData: null as string | null,
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const branding = await prisma.siteBranding.findUnique({
      where: { id: "singleton" },
    });

    if (branding) {
      return NextResponse.json(branding);
    }
    // No DB record yet — return defaults
    return NextResponse.json(demoBranding);
  } catch {
    // DB unavailable — return demo branding
    return NextResponse.json(demoBranding);
  }
}

export async function POST(request: Request) {
  try {
    // Auth check
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasPermission(user, PERMISSIONS.MANAGE_BRANDING)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const companyName = formData.get("companyName") as string | null;
    const logoFile = formData.get("logo") as File | null;
    const faviconFile = formData.get("favicon") as File | null;
    const removeLogo = formData.get("removeLogo") === "true";
    const removeFavicon = formData.get("removeFavicon") === "true";

    // Convert files to base64 data URLs
    let logoData: string | null | undefined = undefined;
    let faviconData: string | null | undefined = undefined;

    if (removeLogo) {
      logoData = null;
    } else if (logoFile && logoFile.size > 0) {
      const bytes = await logoFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      logoData = `data:${logoFile.type};base64,${base64}`;
    }

    if (removeFavicon) {
      faviconData = null;
    } else if (faviconFile && faviconFile.size > 0) {
      const bytes = await faviconFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      faviconData = `data:${faviconFile.type};base64,${base64}`;
    }

    // Build update payload (only include changed fields)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: Record<string, any> = {};
    if (companyName !== null && companyName !== undefined) updatePayload.companyName = companyName;
    if (logoData !== undefined) updatePayload.logoData = logoData;
    if (faviconData !== undefined) updatePayload.faviconData = faviconData;

    try {
      const branding = await prisma.siteBranding.upsert({
        where: { id: "singleton" },
        update: updatePayload,
        create: {
          id: "singleton",
          companyName: companyName || "MortgagePros",
          logoData: logoData ?? null,
          faviconData: faviconData ?? null,
        },
      });

      return NextResponse.json(branding);
    } catch {
      // DB unavailable — update demo branding
      if (companyName) demoBranding.companyName = companyName;
      if (logoData !== undefined) demoBranding.logoData = logoData;
      if (faviconData !== undefined) demoBranding.faviconData = faviconData;
      demoBranding.updatedAt = new Date().toISOString();

      return NextResponse.json(demoBranding);
    }
  } catch (err) {
    console.error("Branding POST error:", err);
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }
}
