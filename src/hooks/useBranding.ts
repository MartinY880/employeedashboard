// ProConnect — useBranding Hook
// Fetches site branding (logo, favicon, company name) and caches it

"use client";

import { useState, useEffect, useCallback } from "react";

export interface Branding {
  companyName: string;
  logoData: string | null;
  faviconData: string | null;
}

const DEFAULT_BRANDING: Branding = {
  companyName: "MortgagePros",
  logoData: null,
  faviconData: null,
};

// Module-level cache so all consumers share the same data
let cachedBranding: Branding | null = null;
let fetchPromise: Promise<Branding> | null = null;

async function fetchBranding(): Promise<Branding> {
  try {
    const res = await fetch("/api/branding", { cache: "no-store" });
    if (!res.ok) return DEFAULT_BRANDING;
    const data = await res.json();
    return {
      companyName: data.companyName || DEFAULT_BRANDING.companyName,
      logoData: data.logoData || null,
      faviconData: data.faviconData || null,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
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

    fetchPromise.then((data) => {
      cachedBranding = data;
      setBranding(data);
      setIsLoading(false);
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
    fetchPromise = null;
    cachedBranding = null;
    const data = await fetchBranding();
    cachedBranding = data;
    fetchPromise = null;
    setBranding(data);
    setIsLoading(false);
  }, []);

  return { branding, isLoading, refresh };
}
