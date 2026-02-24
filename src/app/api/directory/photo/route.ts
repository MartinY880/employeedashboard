// ProConnect — User Photo Proxy API
// Fetches profile photos from Microsoft Graph and serves them as images.
// Falls back to ui-avatars.com when Graph is not configured or user has no photo.

import { NextResponse } from "next/server";
import { isGraphConfigured, getUserPhoto } from "@/lib/graph";

// In-memory cache to avoid hammering Graph API (TTL: 1 hour)
const photoCache = new Map<string, { data: Uint8Array | null; contentType: string | null; ts: number }>();
const CACHE_TTL_MS = Number(process.env.PHOTO_CACHE_TTL_MS || 60 * 60 * 1000); // 1 hour
const MISS_CACHE_TTL_MS = Number(process.env.PHOTO_MISS_CACHE_TTL_MS || 10 * 60 * 1000); // 10 min
const PHOTO_CACHE_MAX_ENTRIES = Number(process.env.PHOTO_CACHE_MAX_ENTRIES || 5000);

function prunePhotoCache() {
  if (photoCache.size <= PHOTO_CACHE_MAX_ENTRIES) return;
  const entries = Array.from(photoCache.entries()).sort((a, b) => a[1].ts - b[1].ts);
  const removeCount = photoCache.size - PHOTO_CACHE_MAX_ENTRIES;
  for (let i = 0; i < removeCount; i += 1) {
    photoCache.delete(entries[i][0]);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const email = searchParams.get("email");
  const name = searchParams.get("name") || "?";
  const size = (searchParams.get("size") || "120x120") as "48x48" | "64x64" | "96x96" | "120x120" | "240x240" | "360x360";

  // No usable identifier or Graph not configured — redirect to ui-avatars
  if ((!userId && !email) || userId?.startsWith("demo-") || !isGraphConfigured) {
    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=06427F&color=fff&size=${parseInt(size)}&bold=true`;
    return NextResponse.redirect(fallbackUrl, 302);
  }

  const candidates = [userId, email].filter((value): value is string => !!value);

  // Fetch from Graph API (try each identifier)
  for (const candidate of candidates) {
    const cacheKey = `${candidate}:${size}`;
    const cached = photoCache.get(cacheKey);
    if (cached) {
      const ageMs = Date.now() - cached.ts;
      const cacheLimit = cached.data ? CACHE_TTL_MS : MISS_CACHE_TTL_MS;
      if (ageMs < cacheLimit) {
        if (cached.data && cached.contentType) {
          return new NextResponse(cached.data as unknown as BodyInit, {
            headers: {
              "Content-Type": cached.contentType,
              "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
            },
          });
        }

        break;
      }
    }

    try {
      const photo = await getUserPhoto(candidate, size);
      if (photo) {
        const bytes = new Uint8Array(photo.data);
        photoCache.set(cacheKey, { data: bytes, contentType: photo.contentType, ts: Date.now() });
        prunePhotoCache();

        return new NextResponse(bytes as unknown as BodyInit, {
          headers: {
            "Content-Type": photo.contentType,
            "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }
    } catch (err) {
      console.error("[Photo API] Error fetching photo for", candidate, err);
    }

    photoCache.set(cacheKey, { data: null, contentType: null, ts: Date.now() });
    prunePhotoCache();
  }

  // No photo found — redirect to ui-avatars fallback
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=06427F&color=fff&size=${parseInt(size)}&bold=true`;
  return NextResponse.redirect(fallbackUrl, 302);
}
