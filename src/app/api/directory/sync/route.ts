import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/logto";
import { hasAnyAdminPermission } from "@/lib/rbac";
import { getOrgHierarchy } from "@/lib/graph";
import {
  getSnapshotSyncMeta,
  getSnapshotUserCount,
  syncDirectorySnapshotFromGraph,
} from "@/lib/directory-snapshot";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasAnyAdminPermission(user)) {
      return forbidden();
    }

    const [meta, count] = await Promise.all([
      getSnapshotSyncMeta(),
      getSnapshotUserCount(),
    ]);

    return NextResponse.json({
      lastSyncedAt: meta.lastSyncedAt,
      isStale: meta.isStale,
      count,
    });
  } catch (error) {
    console.error("[Directory Sync API] GET error:", error);
    return NextResponse.json({ error: "Failed to load sync status" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const { isAuthenticated, user } = await getAuthUser();
    if (!isAuthenticated || !user || !hasAnyAdminPermission(user)) {
      return forbidden();
    }

    const startedAt = Date.now();
    await syncDirectorySnapshotFromGraph();
    const [meta, count] = await Promise.all([
      getSnapshotSyncMeta(),
      getSnapshotUserCount(),
    ]);

    return NextResponse.json({
      ok: true,
      lastSyncedAt: meta.lastSyncedAt,
      count,
      source: "db-snapshot",
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("[Directory Sync API] POST error:", error);

    try {
      const startedAt = Date.now();
      const roots = await getOrgHierarchy();
      const count = countUsers(roots);
      return NextResponse.json({
        ok: true,
        source: "graph-cache",
        count,
        ms: Date.now() - startedAt,
      });
    } catch (graphError) {
      console.error("[Directory Sync API] Graph fallback error:", graphError);
      return NextResponse.json({ error: "Directory sync failed" }, { status: 500 });
    }
  }
}

type TreeNode = { directReports?: TreeNode[] };

function countUsers(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.directReports?.length) {
      count += countUsers(node.directReports);
    }
  }
  return count;
}
