"use client";

import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/components/shared/ThemeProvider";

const TOKEN_REFRESH_MS = 50 * 60 * 1000;

export function DynamicIframeClient({
  id,
  title,
  src,
}: {
  id: string;
  title: string;
  src: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { theme } = useTheme();

  const targetOrigin = (() => {
    try {
      return new URL(src).origin;
    } catch {
      return null;
    }
  })();

  const sendTheme = useCallback((win: Window) => {
    if (!targetOrigin) return;
    win.postMessage({ type: "dj-app:theme", theme }, targetOrigin);
  }, [theme, targetOrigin]);

  const sendToken = useCallback(async () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !targetOrigin) return;

    try {
      const res = await fetch("/api/dj-token", { credentials: "include" });
      if (!res.ok) return;
      const { token, userId, displayName } = await res.json();
      if (!token) return;
      win.postMessage(
        { type: "dj-app:token", token, userId, displayName, theme },
        targetOrigin
      );
    } catch (err) {
      console.error("Failed to send DJ token:", err);
    }
  }, [targetOrigin, theme]);

  useEffect(() => {
    if (!targetOrigin) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== targetOrigin) return;
      if (event.data?.type !== "dj-app:token-request") return;
      sendToken();
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [targetOrigin, sendToken]);

  // Push theme changes to the iframe immediately
  useEffect(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    sendTheme(win);
  }, [theme, sendTheme]);

  const handleLoad = useCallback(() => {
    sendToken();
    if (iframeRef.current?.contentWindow) {
      sendTheme(iframeRef.current.contentWindow);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(sendToken, TOKEN_REFRESH_MS);
  }, [sendToken, sendTheme]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  return (
    <iframe
      ref={iframeRef}
      id={`embedded-${id}`}
      title={title}
      src={src}
      className="w-full h-[78vh]"
      style={{ border: "none" }}
      allow="autoplay; encrypted-media"
      onLoad={handleLoad}
    />
  );
}
