"use client";

import { useEffect, useMemo, useRef } from "react";
import Script from "next/script";

type ClerkSession = {
  id: string;
  getToken: () => Promise<string | null>;
};

type ClerkGlobal = {
  load: () => Promise<void>;
  session: ClerkSession | null;
};

declare global {
  interface Window {
    Clerk?: ClerkGlobal;
  }
}

const DEFAULT_DJ_URL = "https://dj-dev.pros.mortgage/session/1bd44a3e-8ccd-49be-9a05-260acde2f9b7?embed=true";
const DEFAULT_CLERK_PK = "pk_test_cGVyZmVjdC1mYXduLTcwLmNsZXJrLmFjY291bnRzLmRldiQ";
const DEFAULT_CLERK_FRONTEND = "ID"; 
function normalizeFrontendApi(frontendApi: string): string {
  return frontendApi.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

type LogtoTokenResponse = {
  token?: string | null;
  sub?: string | null;
};

async function fetchLogtoAccessToken(): Promise<string | null> {
  try {
    const response = await fetch("/api/iframe/logto-token", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as LogtoTokenResponse;
    return data.token ?? null;
  } catch (error) {
    console.error("[Host] Unable to fetch Logto access token", error);
    return null;
  }
}

export function IframeHostClient() {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const djUrl = process.env.NEXT_PUBLIC_DJ_APP_URL || DEFAULT_DJ_URL;
  const djOrigin = useMemo(() => {
    try {
      return new URL(djUrl).origin;
    } catch {
      return "https://dj-dev.pros.mortgage"; // Fallback origin if URL parsing fails
    }
  }, [djUrl]);

  const clerkPublishableKey =
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || DEFAULT_CLERK_PK;
  const clerkFrontendApi =
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API || DEFAULT_CLERK_FRONTEND;
  const clerkScriptSrc = `https://${normalizeFrontendApi(
    clerkFrontendApi
  )}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== djOrigin) return;
      if ((event.data as { type?: string } | null)?.type !== "dj:clerk-auth-request") return;

      try {
        const logtoToken = await fetchLogtoAccessToken();
        frameRef.current?.contentWindow?.postMessage(
          { type: "dj:clerk-auth-response", token: logtoToken },
          djOrigin
        );
      } catch (error) {
        console.error("[Host] Failed to provide Logto auth to iframe", error);
        frameRef.current?.contentWindow?.postMessage(
          { type: "dj:clerk-auth-response", token: null },
          djOrigin
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [djOrigin]);
  
  return (
    <>
      <Script
        src={clerkScriptSrc}
        strategy="afterInteractive"
        async
        crossOrigin="anonymous"
        data-clerk-publishable-key={clerkPublishableKey}
      />

      <h1 className="text-xl font-semibold text-white">My Website</h1>

      <iframe
        id="dj-frame"
        ref={frameRef}
        src={djUrl}
        width="100%"
        height="700"
        style={{ border: "none", borderRadius: 12 }}
        allow="autoplay; encrypted-media"
      />
    </>
  );
}
