"use client";

const DEFAULT_DJ_URL = "https://dj-dev.pros.mortgage/session/1bd44a3e-8ccd-49be-9a05-260acde2f9b7?embed=true";

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
