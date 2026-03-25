// ProConnect — Mention Search API
// Lightweight directory search for @mention autocomplete
// Searches by first name (prefix match on display_name)
// Returns minimal fields: id, displayName, email, jobTitle

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || "";
  const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10) || 0);

  if (q.length < 3) {
    return NextResponse.json({ users: [], hasMore: false });
  }

  try {
    // Prefix match on first name only:
    // SPLIT_PART extracts the first word of display_name, then ILIKE prefix-matches it
    const prefix = `${q}%`;
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
        (department IS NOT NULL AND TRIM(department) <> '')
        AND (job_title IS NOT NULL AND TRIM(job_title) <> '')
        AND SPLIT_PART(display_name, ' ', 1) ILIKE ${prefix}
      ORDER BY display_name ASC
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
