"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/components/shared/ThemeProvider";

const DEFAULT_DJ_URL =
  "https://dj.pros.mortgage/session/66f1f6b7-6bbc-46ec-9bf2-8e5324823da3?embed=true";
const TOKEN_REFRESH_MS = 50 * 60 * 1000; // 50 minutes — access tokens expire in 60 min

export function IframeHostClient() {
  const djUrl = process.env.NEXT_PUBLIC_DJ_APP_URL || DEFAULT_DJ_URL;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { theme } = useTheme();

  const djOrigin = (() => {
    try {
      return new URL(djUrl).origin;
    } catch {
      return "https://dj-dev.pros.mortgage";
    }
  })();

  const sendTheme = useCallback((win: Window) => {
    try {
      win.postMessage({ type: "dj-app:theme", theme }, djOrigin);
    } catch {
      // iframe navigated away from djOrigin — ignore
    }
  }, [theme, djOrigin]);

  const sendToken = useCallback(async () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    try {
      const res = await fetch("/api/dj-token", { credentials: "include" });
      if (!res.ok) return;
      const { token, userId, displayName } = await res.json();
      if (!token) return;
      try {
        win.postMessage(
          { type: "dj-app:token", token, userId, displayName, theme },
          djOrigin
        );
      } catch {
        // iframe navigated away from djOrigin (e.g. auth loop redirected it to
        // this portal) — clear the refresh timer so we stop trying.
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch (err) {
      console.error("Failed to send DJ token:", err);
    }
  }, [djOrigin, theme]);

  // Listen for token requests from the DJ iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== djOrigin) return;
      if (event.data?.type !== "dj-app:token-request") return;
      sendToken();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [djOrigin, sendToken]);

  // Push theme changes to the iframe immediately (no token re-fetch needed)
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    sendTheme(win);
  }, [theme, sendTheme]);

  // Proactively send token on load and refresh every 50 min
  const handleLoad = useCallback(() => {
    sendToken();
    if (iframeRef.current?.contentWindow) {
      sendTheme(iframeRef.current.contentWindow);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(sendToken, TOKEN_REFRESH_MS);
  }, [sendToken, sendTheme]);

  // Clear refresh timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  return (
    <iframe
      ref={iframeRef}
      id="dj-frame"
      src={djUrl}
      style={{
        display: "block",
        width: "100%",
        // Fill viewport minus TopNav (~80px) + BlueStrip (~52px) + footer (~48px)
        height: "calc(100dvh - 180px)",
        minHeight: 480,
        border: "none",
        background: "var(--brand-bg)",
      }}
      allow="autoplay; encrypted-media"
      onLoad={handleLoad}
    />
  );
}
