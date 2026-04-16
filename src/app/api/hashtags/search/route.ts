import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

export async function GET(req: NextRequest) {
  const { isAuthenticated } = await getAuthUser();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // If no query, fall back to trending
  if (!q) {
    const results = await prisma.commentHashtag.groupBy({
      by: ["hashtagId"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { hashtagId: true },
      orderBy: { _count: { hashtagId: "desc" } },
      take: 20,
    });

    const hashtagIds = results.map((r) => r.hashtagId);
    const hashtags = await prisma.hashtag.findMany({
      where: { id: { in: hashtagIds } },
      select: { id: true, tag: true },
    });

    const tagMap = new Map(hashtags.map((h) => [h.id, h.tag]));

    return NextResponse.json({
      hashtags: results.map((r) => ({
        tag: tagMap.get(r.hashtagId) ?? "",
        count: r._count.hashtagId,
      })),
    });
  }

  // Find hashtags matching the prefix
  const matchingHashtags = await prisma.hashtag.findMany({
    where: { tag: { startsWith: q } },
    select: { id: true, tag: true },
  });

  if (matchingHashtags.length === 0) {
    return NextResponse.json({ hashtags: [] });
  }

  const hashtagIds = matchingHashtags.map((h) => h.id);

  // Count usage in the last 30 days
  const results = await prisma.commentHashtag.groupBy({
    by: ["hashtagId"],
    where: {
      hashtagId: { in: hashtagIds },
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { hashtagId: true },
    orderBy: { _count: { hashtagId: "desc" } },
    take: 20,
  });

  const tagMap = new Map(matchingHashtags.map((h) => [h.id, h.tag]));

  // Include matching hashtags with 0 recent usage at the end
  const countedIds = new Set(results.map((r) => r.hashtagId));
  const withCounts = results.map((r) => ({
    tag: tagMap.get(r.hashtagId) ?? "",
    count: r._count.hashtagId,
  }));
  const zeroCounts = matchingHashtags
    .filter((h) => !countedIds.has(h.id))
    .map((h) => ({ tag: h.tag, count: 0 }));

  return NextResponse.json({
    hashtags: [...withCounts, ...zeroCounts].slice(0, 20),
  });
}
