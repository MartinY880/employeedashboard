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
      // Find or create our own managed favicon link (identified by data attribute)
      let link = document.querySelector("link[data-dynamic-favicon]") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("data-dynamic-favicon", "true");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.type = "image/x-icon";
      link.href = branding.faviconData;
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
