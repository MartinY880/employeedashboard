import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/logto";

export async function GET() {
  const { isAuthenticated } = await getAuthUser();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
