// ProConnect — Directory API Route
// Proxies Microsoft Graph API to fetch org chart / user hierarchy
// Falls back to demo data when Graph API is not configured

import { NextResponse } from "next/server";
import { isGraphConfigured, getAllUsers, getOrgHierarchy, type GraphUser } from "@/lib/graph";
import {
  getSnapshotFlatUsers,
  getSnapshotSyncMeta,
  getSnapshotTreeUsers,
  getSnapshotUserCount,
  searchSnapshotUsers,
  syncDirectorySnapshotFromGraph,
} from "@/lib/directory-snapshot";

const DIRECTORY_HTTP_MAX_AGE_SECONDS = Number(process.env.DIRECTORY_HTTP_MAX_AGE_SECONDS || 300);
const DIRECTORY_HTTP_STALE_SECONDS = Number(process.env.DIRECTORY_HTTP_STALE_SECONDS || 900);

const DIRECTORY_RESPONSE_HEADERS = {
  "Cache-Control": `private, max-age=${DIRECTORY_HTTP_MAX_AGE_SECONDS}, stale-while-revalidate=${DIRECTORY_HTTP_STALE_SECONDS}`,
};

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Helper: build photo proxy URL for a user
function photoUrl(user: { id: string; displayName: string }, size = 120): string {
  return `/api/directory/photo?userId=${encodeURIComponent(user.id)}&name=${encodeURIComponent(user.displayName)}&size=${size}x${size}`;
}

// Helper: inject photoUrl into every node in a tree (mutates in-place)
function injectPhotos(nodes: GraphUser[]): GraphUser[] {
  for (const node of nodes) {
    (node as GraphUser & { photoUrl: string }).photoUrl = photoUrl(node);
    if (node.directReports?.length) {
      injectPhotos(node.directReports);
    }
  }
  return nodes;
}

// Demo data for development when Graph API is not configured
const DEMO_USERS: GraphUser[] = [
  {
    id: "demo-1",
    displayName: "Sarah Mitchell",
    mail: "sarah.mitchell@mortgagepros.com",
    userPrincipalName: "sarah.mitchell@mortgagepros.com",
    jobTitle: "CEO",
    department: "Executive",
    officeLocation: "HQ - Suite 100",
    directReports: [
      {
        id: "demo-2",
        displayName: "James Chen",
        mail: "james.chen@mortgagepros.com",
        userPrincipalName: "james.chen@mortgagepros.com",
        jobTitle: "VP of Operations",
        department: "Operations",
        officeLocation: "HQ - Suite 200",
        directReports: [
          {
            id: "demo-4",
            displayName: "John Doe",
            mail: "john.doe@mortgagepros.com",
            userPrincipalName: "john.doe@mortgagepros.com",
            jobTitle: "Loan Officer",
            department: "Lending",
            officeLocation: "HQ - Floor 3",
            directReports: [],
          },
          {
            id: "demo-5",
            displayName: "Maria Garcia",
            mail: "maria.garcia@mortgagepros.com",
            userPrincipalName: "maria.garcia@mortgagepros.com",
            jobTitle: "Processor",
            department: "Processing",
            officeLocation: "HQ - Floor 3",
            directReports: [],
          },
          {
            id: "demo-8",
            displayName: "David Kim",
            mail: "david.kim@mortgagepros.com",
            userPrincipalName: "david.kim@mortgagepros.com",
            jobTitle: "Underwriter",
            department: "Underwriting",
            officeLocation: "HQ - Floor 2",
            directReports: [],
          },
        ],
      },
      {
        id: "demo-3",
        displayName: "Lisa Park",
        mail: "lisa.park@mortgagepros.com",
        userPrincipalName: "lisa.park@mortgagepros.com",
        jobTitle: "VP of Sales",
        department: "Sales",
        officeLocation: "HQ - Suite 200",
        directReports: [
          {
            id: "demo-6",
            displayName: "Tom Wilson",
            mail: "tom.wilson@mortgagepros.com",
            userPrincipalName: "tom.wilson@mortgagepros.com",
            jobTitle: "Senior Loan Officer",
            department: "Sales",
            officeLocation: "Branch A",
            directReports: [],
          },
          {
            id: "demo-9",
            displayName: "Rachel Adams",
            mail: "rachel.adams@mortgagepros.com",
            userPrincipalName: "rachel.adams@mortgagepros.com",
            jobTitle: "Loan Officer",
            department: "Sales",
            officeLocation: "Branch B",
            directReports: [],
          },
        ],
      },
      {
        id: "demo-7",
        displayName: "Emily Roberts",
        mail: "emily.roberts@mortgagepros.com",
        userPrincipalName: "emily.roberts@mortgagepros.com",
        jobTitle: "Director of Compliance",
        department: "Compliance",
        officeLocation: "HQ - Suite 150",
        directReports: [],
      },
    ],
  },
];

export async function GET(request: Request) {
  try {
    const startedAt = Date.now();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") || "tree"; // "tree" | "flat"
    const countOnly = searchParams.get("count") === "true";
    const search = searchParams.get("search")?.toLowerCase().trim();

    console.log("[Directory API] Request", { mode, countOnly, hasSearch: !!search, graphConfigured: isGraphConfigured });

    // Use Graph API when configured, demo data otherwise
    if (!isGraphConfigured) {
      if (countOnly) {
        return NextResponse.json({ count: countFlat(DEMO_USERS) });
      }

      const flat = flattenTree(DEMO_USERS);
      injectPhotos(flat);

      // People search — filter by name or email
      if (search) {
        const filtered = flat.filter(
          (u) =>
            u.displayName.toLowerCase().includes(search) ||
            (u.mail && u.mail.toLowerCase().includes(search)) ||
            u.userPrincipalName.toLowerCase().includes(search)
        );
        return NextResponse.json({ users: filtered.slice(0, 10) }, { headers: DIRECTORY_RESPONSE_HEADERS });
      }

      if (mode === "flat") {
        return NextResponse.json({ users: flat });
      }
      return NextResponse.json({ users: injectPhotos(JSON.parse(JSON.stringify(DEMO_USERS))) });
    }

    // Real Graph API via DB snapshot for fast reads
    let snapshotMeta = await getSnapshotSyncMeta();

    if (!snapshotMeta.lastSyncedAt) {
      await withTimeout(syncDirectorySnapshotFromGraph(), 30000);
      snapshotMeta = await getSnapshotSyncMeta();
    } else if (snapshotMeta.isStale) {
      void syncDirectorySnapshotFromGraph().catch((error) => {
        console.error("[Directory API] Background snapshot sync failed:", error);
      });
    }

    if (countOnly) {
      const count = await getSnapshotUserCount();
      console.log("[Directory API] Count response", {
        count,
        source: "db-snapshot",
        lastSyncedAt: snapshotMeta.lastSyncedAt,
        ms: Date.now() - startedAt,
      });
      return NextResponse.json({ count }, { headers: DIRECTORY_RESPONSE_HEADERS });
    }

    if (search) {
      const users = await searchSnapshotUsers(search, 10);
      injectPhotos(users);
      console.log("[Directory API] Search response", {
        returned: users.length,
        source: "db-snapshot",
        lastSyncedAt: snapshotMeta.lastSyncedAt,
        ms: Date.now() - startedAt,
      });
      return NextResponse.json({ users }, { headers: DIRECTORY_RESPONSE_HEADERS });
    }

    if (mode === "flat") {
      const users = await getSnapshotFlatUsers();
      injectPhotos(users);
      console.log("[Directory API] Flat response", {
        total: users.length,
        source: "db-snapshot",
        lastSyncedAt: snapshotMeta.lastSyncedAt,
        ms: Date.now() - startedAt,
      });
      return NextResponse.json({ users }, { headers: DIRECTORY_RESPONSE_HEADERS });
    }

    const treeUsers = await getSnapshotTreeUsers();
    injectPhotos(treeUsers);
    const totalUsers = countFlat(treeUsers);
    console.log("[Directory API] Tree response", {
      roots: treeUsers.length,
      totalUsers,
      source: "db-snapshot",
      lastSyncedAt: snapshotMeta.lastSyncedAt,
      ms: Date.now() - startedAt,
    });
    return NextResponse.json({ users: treeUsers }, { headers: DIRECTORY_RESPONSE_HEADERS });
  } catch (error) {
    console.error("[Directory API] Error:", error);
    if (isGraphConfigured) {
      try {
        if (countOnlyFromUrl(request.url)) {
          const users = await getAllUsers();
          return NextResponse.json({ count: users.length }, { headers: DIRECTORY_RESPONSE_HEADERS });
        }

        const mode = modeFromUrl(request.url);
        const search = searchFromUrl(request.url);

        if (search || mode === "flat") {
          const users = await getAllUsers();
          injectPhotos(users);
          if (search) {
            const filtered = users.filter(
              (u) =>
                u.displayName.toLowerCase().includes(search) ||
                (u.mail && u.mail.toLowerCase().includes(search)) ||
                u.userPrincipalName.toLowerCase().includes(search)
            );
            return NextResponse.json({ users: filtered.slice(0, 10) }, { headers: DIRECTORY_RESPONSE_HEADERS });
          }
          return NextResponse.json({ users }, { headers: DIRECTORY_RESPONSE_HEADERS });
        }

        const treeUsers = await withTimeout(getOrgHierarchy(), 15000);
        injectPhotos(treeUsers);
        return NextResponse.json({ users: treeUsers }, { headers: DIRECTORY_RESPONSE_HEADERS });
      } catch (graphFallbackError) {
        console.error("[Directory API] Graph fallback error:", graphFallbackError);
      }
    }

    // Final fallback to demo data
    return NextResponse.json({ users: injectPhotos(JSON.parse(JSON.stringify(DEMO_USERS))) }, { headers: DIRECTORY_RESPONSE_HEADERS });
  }
}

function countOnlyFromUrl(url: string) {
  const { searchParams } = new URL(url);
  return searchParams.get("count") === "true";
}

function modeFromUrl(url: string) {
  const { searchParams } = new URL(url);
  return searchParams.get("mode") || "tree";
}

function searchFromUrl(url: string) {
  const { searchParams } = new URL(url);
  return searchParams.get("search")?.toLowerCase().trim();
}

// Helper: flatten a tree into a flat array
function flattenTree(nodes: GraphUser[]): GraphUser[] {
  const flat: GraphUser[] = [];
  for (const node of nodes) {
    const { directReports, ...user } = node;
    flat.push(user as GraphUser);
    if (directReports?.length) {
      flat.push(...flattenTree(directReports));
    }
  }
  return flat;
}

// Helper: count all users in tree
function countFlat(nodes: GraphUser[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.directReports?.length) {
      count += countFlat(node.directReports);
    }
  }
  return count;
}
