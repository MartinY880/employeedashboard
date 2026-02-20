// ProConnect — User Photo Proxy API
// Fetches profile photos from Microsoft Graph and serves them as images.
// Falls back to ui-avatars.com when Graph is not configured or user has no photo.

import { NextResponse } from "next/server";
import { isGraphConfigured, getUserPhoto } from "@/lib/graph";

// In-memory cache to avoid hammering Graph API (TTL: 1 hour)
const photoCache = new Map<string, { data: Uint8Array; contentType: string; ts: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const name = searchParams.get("name") || "?";
  const size = (searchParams.get("size") || "120x120") as "48x48" | "64x64" | "96x96" | "120x120" | "240x240" | "360x360";

  // No userId or demo user — redirect to ui-avatars
  if (!userId || userId.startsWith("demo-") || !isGraphConfigured) {
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=06427F&color=fff&size=${parseInt(size)}&bold=true`;
    return NextResponse.redirect(fallbackUrl, 302);
  }

  // Check cache
  const cacheKey = `${userId}:${size}`;
  const cached = photoCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return new NextResponse(cached.data as unknown as BodyInit, {
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  }

  // Fetch from Graph API
  try {
    const photo = await getUserPhoto(userId, size);
    if (photo) {
      // Convert Buffer to Uint8Array for caching and response
      const bytes = new Uint8Array(photo.data);
      photoCache.set(cacheKey, { data: bytes, contentType: photo.contentType, ts: Date.now() });

      return new NextResponse(bytes as unknown as BodyInit, {
        headers: {
          "Content-Type": photo.contentType,
          "Cache-Control": "public, max-age=3600, immutable",
        },
      });
    }
  } catch (err) {
    console.error("[Photo API] Error fetching photo for", userId, err);
  }

  // No photo found — redirect to ui-avatars fallback
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=06427F&color=fff&size=${parseInt(size)}&bold=true`;
  return NextResponse.redirect(fallbackUrl, 302);
}
