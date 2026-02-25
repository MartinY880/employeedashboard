"use client";

const DEFAULT_DJ_URL = "https://dj.pros.mortgage/session/66f1f6b7-6bbc-46ec-9bf2-8e5324823da3?embed=true";

export function IframeHostClient() {
  const djUrl = process.env.NEXT_PUBLIC_DJ_APP_URL || DEFAULT_DJ_URL;

  return (
    <iframe
      id="dj-frame"
      src={djUrl}
      width="100%"
      height="700"
      style={{ border: "none", borderRadius: 12 }}
      allow="autoplay; encrypted-media"
    />
  );
}
