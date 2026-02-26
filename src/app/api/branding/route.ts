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

interface TopNavMenuItem {
  id: string;
  label: string;
  href: string;
  active: boolean;
  sortOrder: number;
  iframeUrl?: string;
  icon?: string;
  logoUrl?: string;
}

interface DashboardVisibilitySettings {
  showCompanyPillars: boolean;
  showTournamentBracketLive: boolean;
}

const DEFAULT_SMTP: SmtpSettings = {
  host: "",
  port: "587",
  user: "",
  pass: "",
  from: "",
  fromName: "ProConnect",
};

const DEFAULT_TOPNAV_MENU: TopNavMenuItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", active: true, sortOrder: 0, iframeUrl: "", icon: "dashboard", logoUrl: "" },
  { id: "directory", label: "Directory", href: "/directory", active: true, sortOrder: 1, iframeUrl: "", icon: "directory", logoUrl: "" },
  { id: "calendar", label: "Calendar", href: "/calendar", active: true, sortOrder: 2, iframeUrl: "", icon: "calendar", logoUrl: "" },
  { id: "tournament", label: "Tournament", href: "/tournament", active: true, sortOrder: 3, iframeUrl: "", icon: "tournament", logoUrl: "" },
  { id: "resources", label: "Resources", href: "/resources", active: true, sortOrder: 4, iframeUrl: "", icon: "resources", logoUrl: "" },
];

const DEFAULT_DASHBOARD_VISIBILITY: DashboardVisibilitySettings = {
  showCompanyPillars: true,
  showTournamentBracketLive: true,
};

// In-memory branding for demo mode
const demoBranding = {
  id: "singleton",
  companyName: "MortgagePros",
  logoData: null as string | null,
  darkLogoData: null as string | null,
  faviconData: null as string | null,
  updatedAt: new Date().toISOString(),
};

export async function GET() {
  try {
    const [branding, smtpSetting, topNavSetting, dashboardVisibilitySetting] = await Promise.all([
      prisma.siteBranding.findUnique({ where: { id: "singleton" } }),
      prisma.calendarSetting.findUnique({ where: { id: "smtp_settings" } }),
      prisma.calendarSetting.findUnique({ where: { id: "topnav_menu" } }),
      prisma.calendarSetting.findUnique({ where: { id: "dashboard_visibility" } }),
    ]);

    let smtpSettings = DEFAULT_SMTP;
    if (smtpSetting?.data) {
      try {
        smtpSettings = { ...DEFAULT_SMTP, ...(JSON.parse(smtpSetting.data) as Partial<SmtpSettings>) };
      } catch {
        smtpSettings = DEFAULT_SMTP;
      }
    }

    let topNavMenu = DEFAULT_TOPNAV_MENU;
    if (topNavSetting?.data) {
      try {
        const parsed = JSON.parse(topNavSetting.data) as TopNavMenuItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          topNavMenu = parsed
            .map((item, index) => ({
              id: String(item.id || `menu-${index}`),
              label: String(item.label || "Menu"),
              href: String(item.href || "/dashboard"),
              active: item.active !== false,
              sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
              iframeUrl: String(item.iframeUrl || ""),
              icon: String(item.icon || ""),
              logoUrl: String(item.logoUrl || ""),
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder);
        }
      } catch {
        topNavMenu = DEFAULT_TOPNAV_MENU;
      }
    }

    let dashboardVisibility = DEFAULT_DASHBOARD_VISIBILITY;
    if (dashboardVisibilitySetting?.data) {
      try {
        const parsed = JSON.parse(dashboardVisibilitySetting.data) as Partial<DashboardVisibilitySettings>;
        dashboardVisibility = {
          showCompanyPillars: parsed.showCompanyPillars !== false,
          showTournamentBracketLive: parsed.showTournamentBracketLive !== false,
        };
      } catch {
        dashboardVisibility = DEFAULT_DASHBOARD_VISIBILITY;
      }
    }

    // NOTE: dashboardSlider is intentionally excluded from the GET response.
    // It contains base64 media blobs (10+ MB) and is only managed via /api/dashboard-settings.
    // Including it here caused 18+ MB responses that crippled page loads.
    if (branding) {
      return NextResponse.json({ ...branding, smtpSettings, topNavMenu, dashboardVisibility });
    }
    // No DB record yet — return defaults
    return NextResponse.json({ ...demoBranding, smtpSettings, topNavMenu, dashboardVisibility });
  } catch {
    // DB unavailable — return demo branding
    return NextResponse.json({ ...demoBranding, smtpSettings: DEFAULT_SMTP, topNavMenu: DEFAULT_TOPNAV_MENU, dashboardVisibility: DEFAULT_DASHBOARD_VISIBILITY });
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
    const darkLogoFile = formData.get("darkLogo") as File | null;
    const faviconFile = formData.get("favicon") as File | null;
    const removeLogo = formData.get("removeLogo") === "true";
    const removeFavicon = formData.get("removeFavicon") === "true";
    const removeDarkLogo = formData.get("removeDarkLogo") === "true";
    const smtpSettings: SmtpSettings = {
      host: ((formData.get("smtpHost") as string | null) || "").trim(),
      port: ((formData.get("smtpPort") as string | null) || "587").trim(),
      user: ((formData.get("smtpUser") as string | null) || "").trim(),
      pass: ((formData.get("smtpPass") as string | null) || "").trim(),
      from: ((formData.get("smtpFrom") as string | null) || "").trim(),
      fromName: ((formData.get("smtpFromName") as string | null) || "ProConnect").trim(),
    };
    const topNavRaw = (formData.get("topNavMenu") as string | null) || "";
    const dashboardVisibilityRaw = (formData.get("dashboardVisibility") as string | null) || "";

    let topNavMenu = DEFAULT_TOPNAV_MENU;
    if (topNavRaw) {
      try {
        const parsed = JSON.parse(topNavRaw) as TopNavMenuItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          topNavMenu = parsed
            .map((item, index) => {
              const href = String(item.href || "/dashboard").trim();
              return {
                id: String(item.id || globalThis.crypto?.randomUUID?.() || `menu-${Date.now()}-${index}`),
                label: String(item.label || "Menu").trim() || "Menu",
                href: href.startsWith("/") ? href : `/${href}`,
                active: item.active !== false,
                sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index,
                iframeUrl: String(item.iframeUrl || "").trim(),
                icon: String(item.icon || "").trim(),
                logoUrl: String(item.logoUrl || "").trim(),
              };
            })
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((item, index) => ({ ...item, sortOrder: index }));
        }
      } catch {
        topNavMenu = DEFAULT_TOPNAV_MENU;
      }
    }

    let dashboardVisibility = DEFAULT_DASHBOARD_VISIBILITY;
    if (dashboardVisibilityRaw) {
      try {
        const parsed = JSON.parse(dashboardVisibilityRaw) as Partial<DashboardVisibilitySettings>;
        dashboardVisibility = {
          showCompanyPillars: parsed.showCompanyPillars !== false,
          showTournamentBracketLive: parsed.showTournamentBracketLive !== false,
        };
      } catch {
        dashboardVisibility = DEFAULT_DASHBOARD_VISIBILITY;
      }
    }



    // Convert files to base64 data URLs
    let logoData: string | null | undefined = undefined;
    let darkLogoData: string | null | undefined = undefined;
    let faviconData: string | null | undefined = undefined;

    if (removeLogo) {
      logoData = null;
    } else if (logoFile && logoFile.size > 0) {
      const bytes = await logoFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      logoData = `data:${logoFile.type};base64,${base64}`;
    }

    if (removeDarkLogo) {
      darkLogoData = null;
    } else if (darkLogoFile && darkLogoFile.size > 0) {
      const bytes = await darkLogoFile.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      darkLogoData = `data:${darkLogoFile.type};base64,${base64}`;
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
    if (darkLogoData !== undefined) updatePayload.darkLogoData = darkLogoData;
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
            darkLogoData: darkLogoData ?? null,
            faviconData: faviconData ?? null,
          },
        }),
        prisma.calendarSetting.upsert({
          where: { id: "smtp_settings" },
          update: { data: JSON.stringify(smtpSettings) },
          create: { id: "smtp_settings", data: JSON.stringify(smtpSettings) },
        }),
        prisma.calendarSetting.upsert({
          where: { id: "topnav_menu" },
          update: { data: JSON.stringify(topNavMenu) },
          create: { id: "topnav_menu", data: JSON.stringify(topNavMenu) },
        }),
        prisma.calendarSetting.upsert({
          where: { id: "dashboard_visibility" },
          update: { data: JSON.stringify(dashboardVisibility) },
          create: { id: "dashboard_visibility", data: JSON.stringify(dashboardVisibility) },
        }),
        // NOTE: dashboard_slider is NOT written here — it's managed by /api/dashboard-settings
      ]);

      return NextResponse.json({ ...branding, smtpSettings, topNavMenu, dashboardVisibility });
    } catch {
      // DB unavailable — update demo branding
      if (companyName) demoBranding.companyName = companyName;
      if (logoData !== undefined) demoBranding.logoData = logoData;
      if (darkLogoData !== undefined) demoBranding.darkLogoData = darkLogoData;
      if (faviconData !== undefined) demoBranding.faviconData = faviconData;
      demoBranding.updatedAt = new Date().toISOString();

      return NextResponse.json({ ...demoBranding, smtpSettings, topNavMenu, dashboardVisibility });
    }
  } catch (err) {
    console.error("Branding POST error:", err);
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }
}
