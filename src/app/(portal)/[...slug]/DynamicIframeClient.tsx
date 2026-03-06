"use client";

import { useEffect, useRef, useCallback } from "react";

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

  const targetOrigin = (() => {
    try {
      return new URL(src).origin;
    } catch {
      return null;
    }
  })();

  const sendToken = useCallback(async () => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !targetOrigin) return;

    try {
      const res = await fetch("/api/dj-token", { credentials: "include" });
      if (!res.ok) return;
      const { token, userId, displayName } = await res.json();
      if (!token) return;
      win.postMessage(
        { type: "dj-app:token", token, userId, displayName },
        targetOrigin
      );
    } catch (err) {
      console.error("Failed to send DJ token:", err);
    }
  }, [targetOrigin]);

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

  const handleLoad = useCallback(() => {
    sendToken();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(sendToken, TOKEN_REFRESH_MS);
  }, [sendToken]);

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
