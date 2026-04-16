// ProConnect — Hashtag Utilities
// Parse, extract, and manage #hashtag tracking in comment content
// Format: #word (plain text, case-insensitive, stored lowercase)

import type { PrismaClient } from "@/generated/prisma/client";
import type { CommentType } from "@/generated/prisma/client";

/** Regex to match hashtag tokens in content — word chars only */
const HASHTAG_REGEX = /#(\w+)/g;

/**
 * Extract all unique hashtags from comment content.
 * Returns deduplicated, lowercased tag strings (without the # prefix).
 */
export function extractHashtags(content: string): string[] {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(HASHTAG_REGEX.source, "g");

  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }

  return Array.from(tags);
}

/**
 * Parse hashtags from content, upsert Hashtag rows, and create CommentHashtag
 * junction rows. Call this after creating a comment in any of the 5 API routes.
 */
export async function upsertHashtags(
  prisma: PrismaClient,
  commentId: string,
  commentType: CommentType,
  content: string,
): Promise<void> {
  const tags = extractHashtags(content);
  if (tags.length === 0) return;

  for (const tag of tags) {
    const hashtag = await prisma.hashtag.upsert({
      where: { tag },
      create: { tag },
      update: {},
    });

    await prisma.commentHashtag.upsert({
      where: {
        hashtagId_commentId_commentType: {
          hashtagId: hashtag.id,
          commentId,
          commentType,
        },
      },
      create: {
        hashtagId: hashtag.id,
        commentId,
        commentType,
      },
      update: {},
    });
  }
}

/**
 * Remove all CommentHashtag junction rows for a given comment.
 * Call this when deleting (or soft-deleting) a comment.
 */
export async function removeCommentHashtags(
  prisma: PrismaClient,
  commentId: string,
  commentType: CommentType,
): Promise<void> {
  await prisma.commentHashtag.deleteMany({
    where: { commentId, commentType },
  });
}
