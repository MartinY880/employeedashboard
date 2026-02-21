// ProConnect — DynamicFavicon Component
// Client component that updates the browser favicon from site branding

"use client";

import { useBranding } from "@/hooks/useBranding";

export function DynamicFavicon() {
  // The useBranding hook handles updating the <link rel="icon"> tag
  useBranding();
  return null;
}
