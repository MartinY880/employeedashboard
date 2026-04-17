// ProConnect — Rich Link Preview Card
// Fetches OG metadata and renders a compact Slack/iMessage-style card.

"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe } from "lucide-react";

interface LinkMeta {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

function formatLinkText(raw: string): string {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname + url.search + url.hash;
    if (path.length <= 1) return host;
    if (path.length > 20) return `${host}/\u2026`;
    return `${host}${path}`;
  } catch {
    return raw.length > 40 ? `${raw.slice(0, 37)}\u2026` : raw;
  }
}

export function LinkPreviewCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d: LinkMeta) => {
        if (!cancelled) setMeta(d);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [url]);

  // While loading, show a minimal skeleton
  if (loading) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-brand-blue underline decoration-brand-blue/30 hover:decoration-brand-blue/60 text-[12px] transition-colors"
      >
        <Globe className="w-3 h-3 shrink-0 animate-pulse" />
        <span className="truncate">{formatLinkText(url)}</span>
      </a>
    );
  }

  // If fetch failed or no metadata at all, fall back to a simple styled link
  if (errored || !meta || (!meta.title && !meta.description)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-brand-blue underline decoration-brand-blue/30 hover:decoration-brand-blue/60 text-[12px] transition-colors"
      >
        <ExternalLink className="w-3 h-3 shrink-0" />
        <span className="truncate">{formatLinkText(url)}</span>
      </a>
    );
  }

  const hostname = (() => {
    try { return new URL(meta.url).hostname.replace(/^www\./, ""); } catch { return meta.siteName ?? url; }
  })();

  return (
    <a
      href={meta.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/link flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-brand-blue/40 hover:bg-brand-blue/[0.02] dark:hover:bg-brand-blue/5 transition-all overflow-hidden my-1 max-w-[340px]"
    >
      {/* OG image thumbnail */}
      {meta.image && (
        <div className="shrink-0 w-[72px] h-[72px] bg-gray-100 dark:bg-gray-700 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meta.image}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
      {/* Text content */}
      <div className="flex-1 min-w-0 px-2.5 py-1.5">
        {/* Site name + favicon */}
        <div className="flex items-center gap-1 mb-0.5">
          {meta.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.favicon}
              alt=""
              className="w-3 h-3 rounded-sm shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).replaceWith(document.createElement("span")); }}
            />
          ) : (
            <Globe className="w-3 h-3 text-gray-400 shrink-0" />
          )}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate leading-none">
            {meta.siteName ?? hostname}
          </span>
        </div>
        {/* Title */}
        {meta.title && (
          <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 leading-tight line-clamp-2 group-hover/link:text-brand-blue transition-colors">
            {meta.title}
          </p>
        )}
        {/* Description */}
        {meta.description && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug line-clamp-1 mt-0.5">
            {meta.description}
          </p>
        )}
      </div>
    </a>
  );
}
