// ProConnect — Mention Utilities
// Parse, extract, and render @mention markup in comment content
// Format: @[Display Name](userId)

/** Regex to match mention tokens in stored content */
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

export interface MentionToken {
  displayName: string;
  userId: string;
}

/**
 * Extract all unique mentions from comment content.
 * Deduplicates by userId.
 */
export function extractMentions(content: string): MentionToken[] {
  const seen = new Set<string>();
  const mentions: MentionToken[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX.source, "g");

  while ((match = regex.exec(content)) !== null) {
    const [, displayName, userId] = match;
    if (!seen.has(userId)) {
      seen.add(userId);
      mentions.push({ displayName, userId });
    }
  }

  return mentions;
}

/**
 * Get the plain-text display version of content (strips mention markup).
 * "@[John Doe](abc123)" → "@John Doe"
 */
export function stripMentionMarkup(content: string): string {
  return content.replace(MENTION_REGEX, "@$1");
}

/**
 * Calculate display length of content (with mention markup stripped).
 * Use this for character-limit validation instead of raw string length.
 */
export function mentionDisplayLength(content: string): number {
  return stripMentionMarkup(content).length;
}
