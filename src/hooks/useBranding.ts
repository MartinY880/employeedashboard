// ProConnect — useBranding Hook
// Fetches site branding (logo, favicon, company name) and caches it

"use client";

import { useState, useEffect, useCallback } from "react";

export interface Branding {
  companyName: string;
  logoData: string | null;
  faviconData: string | null;
  topNavMenu: Array<{
    id: string;
    label: string;
    href: string;
    active: boolean;
    sortOrder: number;
    iframeUrl?: string;
    icon?: string;
    logoUrl?: string;
  }>;
}

const DEFAULT_BRANDING: Branding = {
  companyName: "MortgagePros",
  logoData: null,
  faviconData: null,
  topNavMenu: [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", active: true, sortOrder: 0, iframeUrl: "", icon: "dashboard", logoUrl: "" },
    { id: "directory", label: "Directory", href: "/directory", active: true, sortOrder: 1, iframeUrl: "", icon: "directory", logoUrl: "" },
    { id: "calendar", label: "Calendar", href: "/calendar", active: true, sortOrder: 2, iframeUrl: "", icon: "calendar", logoUrl: "" },
    { id: "tournament", label: "Tournament", href: "/tournament", active: true, sortOrder: 3, iframeUrl: "", icon: "tournament", logoUrl: "" },
    { id: "resources", label: "Resources", href: "/resources", active: true, sortOrder: 4, iframeUrl: "", icon: "resources", logoUrl: "" },
  ],
};

// Module-level cache so all consumers share the same data
let cachedBranding: Branding | null = null;
let fetchPromise: Promise<Branding> | null = null;

async function fetchBranding(): Promise<Branding> {
  const res = await fetch("/api/branding", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Branding fetch failed: ${res.status}`);
  }
  const data = await res.json();
  return {
    companyName: data.companyName || DEFAULT_BRANDING.companyName,
    logoData: data.logoData || null,
    faviconData: data.faviconData || null,
    topNavMenu: Array.isArray(data.topNavMenu) && data.topNavMenu.length > 0
      ? data.topNavMenu
      : DEFAULT_BRANDING.topNavMenu,
  };
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(cachedBranding || DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(!cachedBranding);

  useEffect(() => {
    if (cachedBranding) {
      setBranding(cachedBranding);
      setIsLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchBranding();
    }

    fetchPromise
      .then((data) => {
        cachedBranding = data;
        setBranding(data);
      })
      .catch(() => {
        // Keep current value (cached or default) on transient failure
      })
      .finally(() => {
        setIsLoading(false);
        fetchPromise = null;
      });
  }, []);

  // Update favicon link tag whenever faviconData changes
  useEffect(() => {
    if (branding.faviconData) {
      // Update any existing icon link, or create one if none exists
      const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (existing) {
        existing.href = branding.faviconData;
        existing.type = branding.faviconData.startsWith('data:image/png') ? 'image/png' : 'image/x-icon';
      } else {
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = branding.faviconData.startsWith('data:image/png') ? 'image/png' : 'image/x-icon';
        link.href = branding.faviconData;
        document.head.appendChild(link);
      }
    }
  }, [branding.faviconData]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchBranding();
      cachedBranding = data;
      setBranding(data);
    } catch {
      // Preserve previous branding on refresh failure
    } finally {
      fetchPromise = null;
      setIsLoading(false);
    }
  }, []);

  return { branding, isLoading, refresh };
}
