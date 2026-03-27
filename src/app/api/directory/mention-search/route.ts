// ProConnect — Mention Search API
// Lightweight directory search for @mention autocomplete
// Searches by progressive full-name token matching
// Returns minimal fields: id, displayName, email, jobTitle

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const normalizedQ = q.replace(/\s+/g, " ");
  // Ignore hyphens/apostrophes so users can type plain text for names
  // like D'Andre, T'yana, or Chapman-Anderson.
  const punctuationInsensitiveQ = normalizedQ.replace(/[-']/g, "");
  const canonicalQ = punctuationInsensitiveQ
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  if (canonicalQ.length < 3) {
    return NextResponse.json({ users: [], hasMore: false });
  }

  try {
    // Progressive token matching:
    // "Crystal S" -> "Crystal%S%"
    // "Anna Maria Last" -> "Anna%Maria%Last%"
    // This keeps results narrowing as users type additional name parts.
    const tokens = canonicalQ.split(" ").filter(Boolean);
    const tokenPattern = `${tokens.join("%")}%`;
    const directPrefixPattern = `${canonicalQ}%`;
    const rows = await prisma.$queryRaw<
      { id: string; displayName: string; mail: string | null; userPrincipalName: string; jobTitle: string | null }[]
    >`
      SELECT
        id,
        display_name AS "displayName",
        mail,
        user_principal_name AS "userPrincipalName",
        job_title AS "jobTitle"
      FROM directory_snapshots
      WHERE
        (display_name IS NOT NULL AND TRIM(display_name) <> '')
        AND ((mail IS NOT NULL AND TRIM(mail) <> '') OR (user_principal_name IS NOT NULL AND TRIM(user_principal_name) <> ''))
        AND REGEXP_REPLACE(
          REGEXP_REPLACE(LOWER(TRIM(display_name)), '[-'']+', '', 'g'),
          '[^[:alnum:]]+',
          ' ',
          'g'
        ) ILIKE LOWER(${tokenPattern})
      ORDER BY
        CASE
          WHEN REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(TRIM(display_name)), '[-'']+', '', 'g'),
            '[^[:alnum:]]+',
            ' ',
            'g'
          ) ILIKE LOWER(${directPrefixPattern}) THEN 0
          ELSE 1
        END,
        display_name ASC
      LIMIT 9
      OFFSET ${offset}
    `;

    const hasMore = rows.length > 8;
    const users = rows.slice(0, 8).map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.mail || u.userPrincipalName,
      jobTitle: u.jobTitle || null,
    }));

    return NextResponse.json(
      { users, hasMore },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    console.error("[MentionSearch] Error:", err);
    return NextResponse.json({ users: [] }, { status: 500 });
  }
}
