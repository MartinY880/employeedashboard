import "server-only";

import { prisma } from "@/lib/prisma";
import { getOrgHierarchy, type GraphUser } from "@/lib/graph";

const SNAPSHOT_SYNC_TTL_MS = Number(process.env.DIRECTORY_SNAPSHOT_SYNC_TTL_MS || 15 * 60 * 1000);

type SnapshotRow = {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle: string | null;
  employeeType: string | null;
  department: string | null;
  officeLocation: string | null;
  managerId: string | null;
};

type SnapshotMetaRow = {
  last_synced_at: Date | null;
};

let ensureTablesPromise: Promise<void> | null = null;
let syncInFlight: Promise<void> | null = null;

function flattenTreeWithManagers(nodes: GraphUser[], managerId: string | null = null): SnapshotRow[] {
  const flat: SnapshotRow[] = [];

  for (const node of nodes) {
    flat.push({
      id: node.id,
      displayName: node.displayName,
      mail: node.mail,
      userPrincipalName: node.userPrincipalName,
      jobTitle: node.jobTitle,
      employeeType: node.employeeType ?? null,
      department: node.department,
      officeLocation: node.officeLocation,
      managerId,
    });

    if (node.directReports?.length) {
      flat.push(...flattenTreeWithManagers(node.directReports, node.id));
    }
  }

  return flat;
}

function mapRowsToTree(rows: SnapshotRow[]): GraphUser[] {
  const map = new Map<string, GraphUser & { managerId: string | null }>();

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      displayName: row.displayName,
      mail: row.mail,
      userPrincipalName: row.userPrincipalName,
      jobTitle: row.jobTitle,
      employeeType: row.employeeType,
      department: row.department,
      officeLocation: row.officeLocation,
      managerId: row.managerId,
      directReports: [],
    });
  }

  const roots: GraphUser[] = [];
  for (const node of map.values()) {
    if (node.managerId && map.has(node.managerId)) {
      map.get(node.managerId)?.directReports?.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (nodes: GraphUser[]) => {
    nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));
    for (const node of nodes) {
      if (node.directReports?.length) {
        sortTree(node.directReports);
      }
    }
  };

  sortTree(roots);
  return roots;
}

async function ensureSnapshotTables() {
  if (!ensureTablesPromise) {
    ensureTablesPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS directory_snapshots (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          mail TEXT NULL,
          user_principal_name TEXT NOT NULL,
          job_title TEXT NULL,
          employee_type TEXT NULL,
          department TEXT NULL,
          office_location TEXT NULL,
          manager_id TEXT NULL,
          synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS directory_snapshot_state (
          id TEXT PRIMARY KEY,
          last_synced_at TIMESTAMPTZ NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await prisma.$executeRawUnsafe(
        "CREATE INDEX IF NOT EXISTS idx_directory_snapshots_manager_id ON directory_snapshots(manager_id);"
      );
      await prisma.$executeRawUnsafe(
        "CREATE INDEX IF NOT EXISTS idx_directory_snapshots_display_name ON directory_snapshots(display_name);"
      );
      await prisma.$executeRawUnsafe(
        "CREATE INDEX IF NOT EXISTS idx_directory_snapshots_mail ON directory_snapshots(mail);"
      );
      await prisma.$executeRawUnsafe(
        "CREATE INDEX IF NOT EXISTS idx_directory_snapshots_upn ON directory_snapshots(user_principal_name);"
      );
    })().catch((error) => {
      ensureTablesPromise = null;
      throw error;
    });
  }

  return ensureTablesPromise;
}

export async function getSnapshotSyncMeta(): Promise<{ lastSyncedAt: Date | null; isStale: boolean }> {
  await ensureSnapshotTables();
  const rows = await prisma.$queryRaw<SnapshotMetaRow[]>`
    SELECT last_synced_at
    FROM directory_snapshot_state
    WHERE id = 'singleton'
    LIMIT 1
  `;

  const lastSyncedAt = rows[0]?.last_synced_at ?? null;
  const isStale = !lastSyncedAt || Date.now() - new Date(lastSyncedAt).getTime() > SNAPSHOT_SYNC_TTL_MS;
  return { lastSyncedAt, isStale };
}

export async function syncDirectorySnapshotFromGraph(): Promise<void> {
  await ensureSnapshotTables();

  if (!syncInFlight) {
    syncInFlight = (async () => {
      const roots = await getOrgHierarchy();
      const flat = flattenTreeWithManagers(roots);
      const ids = flat.map((user) => user.id);

      await prisma.$transaction(async (tx) => {
        for (const user of flat) {
          await tx.$executeRaw`
            INSERT INTO directory_snapshots (
              id,
              display_name,
              mail,
              user_principal_name,
              job_title,
              employee_type,
              department,
              office_location,
              manager_id,
              synced_at
            ) VALUES (
              ${user.id},
              ${user.displayName},
              ${user.mail},
              ${user.userPrincipalName},
              ${user.jobTitle},
              ${user.employeeType},
              ${user.department},
              ${user.officeLocation},
              ${user.managerId},
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              display_name = EXCLUDED.display_name,
              mail = EXCLUDED.mail,
              user_principal_name = EXCLUDED.user_principal_name,
              job_title = EXCLUDED.job_title,
              employee_type = EXCLUDED.employee_type,
              department = EXCLUDED.department,
              office_location = EXCLUDED.office_location,
              manager_id = EXCLUDED.manager_id,
              synced_at = NOW()
          `;
        }

        if (ids.length > 0) {
          await tx.$executeRaw`
            DELETE FROM directory_snapshots
            WHERE NOT (id = ANY(${ids}))
          `;
        } else {
          await tx.$executeRaw`DELETE FROM directory_snapshots`;
        }

        await tx.$executeRaw`
          INSERT INTO directory_snapshot_state (id, last_synced_at, updated_at)
          VALUES ('singleton', NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            last_synced_at = EXCLUDED.last_synced_at,
            updated_at = NOW()
        `;
      }, { timeout: 20000 });
    })().finally(() => {
      syncInFlight = null;
    });
  }

  await syncInFlight;
}

export async function getSnapshotUserCount(): Promise<number> {
  await ensureSnapshotTables();
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM directory_snapshots
  `;
  return Number(rows[0]?.count ?? BigInt(0));
}

export async function getSnapshotFlatUsers(): Promise<GraphUser[]> {
  await ensureSnapshotTables();
  const rows = await prisma.$queryRaw<SnapshotRow[]>`
    SELECT
      id,
      display_name AS "displayName",
      mail,
      user_principal_name AS "userPrincipalName",
      job_title AS "jobTitle",
      employee_type AS "employeeType",
      department,
      office_location AS "officeLocation",
      manager_id AS "managerId"
    FROM directory_snapshots
    ORDER BY display_name ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    mail: row.mail,
    userPrincipalName: row.userPrincipalName,
    jobTitle: row.jobTitle,
    employeeType: row.employeeType,
    department: row.department,
    officeLocation: row.officeLocation,
  }));
}

export async function searchSnapshotUsers(search: string, limit = 10): Promise<GraphUser[]> {
  await ensureSnapshotTables();
  const query = `%${search}%`;
  const rows = await prisma.$queryRaw<SnapshotRow[]>`
    SELECT
      id,
      display_name AS "displayName",
      mail,
      user_principal_name AS "userPrincipalName",
      job_title AS "jobTitle",
      employee_type AS "employeeType",
      department,
      office_location AS "officeLocation",
      manager_id AS "managerId"
    FROM directory_snapshots
    WHERE
      display_name ILIKE ${query}
      OR COALESCE(mail, '') ILIKE ${query}
      OR user_principal_name ILIKE ${query}
    ORDER BY display_name ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    mail: row.mail,
    userPrincipalName: row.userPrincipalName,
    jobTitle: row.jobTitle,
    employeeType: row.employeeType,
    department: row.department,
    officeLocation: row.officeLocation,
  }));
}

export async function getSnapshotTreeUsers(): Promise<GraphUser[]> {
  await ensureSnapshotTables();
  const rows = await prisma.$queryRaw<SnapshotRow[]>`
    SELECT
      id,
      display_name AS "displayName",
      mail,
      user_principal_name AS "userPrincipalName",
      job_title AS "jobTitle",
      employee_type AS "employeeType",
      department,
      office_location AS "officeLocation",
      manager_id AS "managerId"
    FROM directory_snapshots
    ORDER BY display_name ASC
  `;

  return mapRowsToTree(rows);
}
