// ProConnect — Link Preview API
// GET: fetch Open Graph metadata for a URL (title, description, image, favicon, siteName)

import { NextResponse } from "next/server";

interface LinkMeta {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

// Simple in-memory cache (survives across requests in the same server process)
const cache = new Map<string, { data: LinkMeta; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MAX_CACHE = 500;

function extractMeta(html: string, baseUrl: string): Omit<LinkMeta, "url"> {
  const get = (property: string): string | null => {
    // Match <meta property="og:..." content="..."> or <meta name="..." content="...">
    const re = new RegExp(
      `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
      "i",
    );
    return re.exec(html)?.[1] ?? alt.exec(html)?.[1] ?? null;
  };

  const title =
    get("og:title") ??
    (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null);

  const description = get("og:description") ?? get("description");
  const image = get("og:image");
  const siteName = get("og:site_name");

  // Favicon: look for <link rel="icon" href="...">
  const faviconMatch =
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i.exec(html) ??
    /<link[^>]*href=["']([^"']*)["'][^>]*rel=["'](?:shortcut )?icon["']/i.exec(html);

  let favicon = faviconMatch?.[1] ?? null;
  if (favicon && !favicon.startsWith("http")) {
    try {
      favicon = new URL(favicon, baseUrl).href;
    } catch {
      favicon = null;
    }
  }
  // Fallback to /favicon.ico
  if (!favicon) {
    try {
      favicon = new URL("/favicon.ico", baseUrl).href;
    } catch {
      favicon = null;
    }
  }

  return { title, description, image, favicon, siteName };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Normalize URL
  let targetUrl: string;
  try {
    targetUrl = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    const parsed = new URL(targetUrl);
    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }
    // Block private/internal IPs
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.") ||
      host === "[::1]" ||
      host.endsWith(".local") ||
      host.endsWith(".internal")
    ) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(targetUrl);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ProConnect-LinkPreview/1.0",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({
        url: targetUrl,
        title: null,
        description: null,
        image: null,
        favicon: null,
        siteName: new URL(targetUrl).hostname,
      } satisfies LinkMeta);
    }

    // Only read first 50KB to avoid large payloads
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytes = 0;
      while (bytes < 50_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
        bytes += value.length;
      }
      reader.cancel().catch(() => {});
    }

    const meta = extractMeta(html, targetUrl);
    const result: LinkMeta = { url: targetUrl, ...meta };

    // Cache the result
    if (cache.size >= MAX_CACHE) {
      // Evict oldest entry
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(targetUrl, { data: result, ts: Date.now() });

    return NextResponse.json(result);
  } catch {
    // Return minimal data on failure
    return NextResponse.json({
      url: targetUrl,
      title: null,
      description: null,
      image: null,
      favicon: null,
      siteName: new URL(targetUrl).hostname,
    } satisfies LinkMeta);
  }
}
