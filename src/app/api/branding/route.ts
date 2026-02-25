// ProConnect — Branding API Route
// GET: Fetch current site branding | POST: Update branding (admin only)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";

interface SmtpSettings {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  fromName: string;
}

const DEFAULT_SMTP: SmtpSettings = {
  host: "",
  port: "587",
  user: "",
  pass: "",
  from: "",
  fromName: "ProConnect",
};

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
    const [branding, smtpSetting] = await Promise.all([
      prisma.siteBranding.findUnique({ where: { id: "singleton" } }),
      prisma.calendarSetting.findUnique({ where: { id: "smtp_settings" } }),
    ]);

    let smtpSettings = DEFAULT_SMTP;
    if (smtpSetting?.data) {
      try {
        smtpSettings = { ...DEFAULT_SMTP, ...(JSON.parse(smtpSetting.data) as Partial<SmtpSettings>) };
      } catch {
        smtpSettings = DEFAULT_SMTP;
      }
    }

    if (branding) {
      return NextResponse.json({ ...branding, smtpSettings });
    }
    // No DB record yet — return defaults
    return NextResponse.json({ ...demoBranding, smtpSettings });
  } catch {
    // DB unavailable — return demo branding
    return NextResponse.json({ ...demoBranding, smtpSettings: DEFAULT_SMTP });
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
    const smtpSettings: SmtpSettings = {
      host: ((formData.get("smtpHost") as string | null) || "").trim(),
      port: ((formData.get("smtpPort") as string | null) || "587").trim(),
      user: ((formData.get("smtpUser") as string | null) || "").trim(),
      pass: ((formData.get("smtpPass") as string | null) || "").trim(),
      from: ((formData.get("smtpFrom") as string | null) || "").trim(),
      fromName: ((formData.get("smtpFromName") as string | null) || "ProConnect").trim(),
    };

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
      const [branding] = await Promise.all([
        prisma.siteBranding.upsert({
          where: { id: "singleton" },
          update: updatePayload,
          create: {
            id: "singleton",
            companyName: companyName || "MortgagePros",
            logoData: logoData ?? null,
            faviconData: faviconData ?? null,
          },
        }),
        prisma.calendarSetting.upsert({
          where: { id: "smtp_settings" },
          update: { data: JSON.stringify(smtpSettings) },
          create: { id: "smtp_settings", data: JSON.stringify(smtpSettings) },
        }),
      ]);

      return NextResponse.json({ ...branding, smtpSettings });
    } catch {
      // DB unavailable — update demo branding
      if (companyName) demoBranding.companyName = companyName;
      if (logoData !== undefined) demoBranding.logoData = logoData;
      if (faviconData !== undefined) demoBranding.faviconData = faviconData;
      demoBranding.updatedAt = new Date().toISOString();

      return NextResponse.json({ ...demoBranding, smtpSettings });
    }
  } catch (err) {
    console.error("Branding POST error:", err);
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }
}
