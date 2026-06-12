import "server-only";

import { prisma } from "@/lib/prisma";
import { fetchAllUsersFromGraphUnfiltered, resolveManagerIds, type GraphUser } from "@/lib/graph";
import {
  isM2MConfigured,
  syncUserRole,
  resolveJobTitleRoleTarget,
  suspendUser,
  unsuspendUser,
} from "@/lib/logto-management";

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
  businessPhone: string | null;
  mobilePhone: string | null;
  faxNumber: string | null;
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
      businessPhone: node.businessPhone ?? null,
      mobilePhone: node.mobilePhone ?? null,
      faxNumber: node.faxNumber ?? null,
      managerId,
    });

    if (node.directReports?.length) {
      flat.push(...flattenTreeWithManagers(node.directReports, node.id));
    }
  }

  return flat;
}

/**
 * Build a flat list of SnapshotRows with manager IDs resolved via Graph batch API.
 * Used for the unfiltered storage sync — every active+licensed user gets a row.
 */
async function buildFlatWithManagers(users: GraphUser[]): Promise<SnapshotRow[]> {
  const managerMap = await resolveManagerIds(users);

  return users.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    mail: user.mail,
    userPrincipalName: user.userPrincipalName,
    jobTitle: user.jobTitle,
    employeeType: user.employeeType ?? null,
    department: user.department,
    officeLocation: user.officeLocation,
    businessPhone: user.businessPhone ?? null,
    mobilePhone: user.mobilePhone ?? null,
    faxNumber: user.faxNumber ?? null,
    managerId: managerMap.get(user.id) ?? null,
  }));
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
      businessPhone: row.businessPhone,
      mobilePhone: row.mobilePhone,
      faxNumber: row.faxNumber,
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

  // ── DEPRECATED: hardcoded managing-partner root sort (replaced by branch system) ──
  // Branch ordering of the root's direct reports is now applied client-side in
  // DirectoryOrgChart via branch sortOrder. Kept here commented for reference.
  // const MANAGING_PARTNER_NAMES = new Set([
  //   "george abro",
  //   "nathan shamo",
  //   "andrew shamo",
  //   "anthony karana",
  //   "kevin kajy",
  //   "donovan shaow",
  // ]);
  //
  // const sortTreeLegacy = (nodes: GraphUser[], isRoot = false) => {
  //   if (isRoot) {
  //     // At root level: Managing Partners first, then alphabetical within groups
  //     const partners: GraphUser[] = [];
  //     const others: GraphUser[] = [];
  //     for (const node of nodes) {
  //       if (
  //         node.jobTitle?.toLowerCase().includes("managing partner") ||
  //         MANAGING_PARTNER_NAMES.has(node.displayName.toLowerCase())
  //       ) {
  //         partners.push(node);
  //       } else {
  //         others.push(node);
  //       }
  //     }
  //     partners.sort((a, b) => a.displayName.localeCompare(b.displayName));
  //     others.sort((a, b) => a.displayName.localeCompare(b.displayName));
  //     nodes.length = 0;
  //     nodes.push(...partners, ...others);
  //   } else {
  //     nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));
  //   }
  //   for (const node of nodes) {
  //     if (node.directReports?.length) {
  //       sortTreeLegacy(node.directReports);
  //     }
  //   }
  // };

  // Alphabetical at every level.
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
          business_phone TEXT NULL,
          mobile_phone TEXT NULL,
          fax_number TEXT NULL,
          manager_id TEXT NULL,
          synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await prisma.$executeRawUnsafe(
        "ALTER TABLE directory_snapshots ADD COLUMN IF NOT EXISTS business_phone TEXT NULL;"
      );
      await prisma.$executeRawUnsafe(
        "ALTER TABLE directory_snapshots ADD COLUMN IF NOT EXISTS mobile_phone TEXT NULL;"
      );
      await prisma.$executeRawUnsafe(
        "ALTER TABLE directory_snapshots ADD COLUMN IF NOT EXISTS fax_number TEXT NULL;"
      );

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
      // Fetch ALL active+licensed users (unfiltered) so every employee
      // gets a directory_snapshots row for name lookups (celebrations, exams, etc.).
      // Display filters are applied at query time, not at storage time.
      const allUsers = await fetchAllUsersFromGraphUnfiltered();
      const flat = await buildFlatWithManagers(allUsers);
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
              business_phone,
              mobile_phone,
              fax_number,
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
              ${user.businessPhone},
              ${user.mobilePhone},
              ${user.faxNumber},
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
                business_phone = EXCLUDED.business_phone,
                mobile_phone = EXCLUDED.mobile_phone,
                fax_number = EXCLUDED.fax_number,
              manager_id = EXCLUDED.manager_id,
              synced_at = NOW()
          `;
        }

        // ── DEPRECATED: hardcoded managing-partner job_title backfill ──
        // Replaced by the root-subtree inclusion model. Kept commented for reference.
        // const MANAGING_PARTNER_NAMES_DB = [
        //   'george abro', 'nathan shamo', 'andrew shamo',
        //   'anthony karana', 'kevin kajy', 'donovan shaow',
        // ];
        // await tx.$executeRaw`
        //   UPDATE directory_snapshots
        //   SET job_title = 'Managing Partner'
        //   WHERE (job_title IS NULL OR TRIM(job_title) = '')
        //     AND LOWER(display_name) = ANY(${MANAGING_PARTNER_NAMES_DB})
        // `;

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

      // ── Post-sync: reconcile Logto roles in the background (non-blocking) ──
      if (isM2MConfigured) {
        const usersWithEmail = flat.filter((u) => u.mail);
        // Fire-and-forget so the directory sync returns immediately
        void (async () => {
          for (const user of usersWithEmail) {
            try {
              const target = await resolveJobTitleRoleTarget(user.jobTitle);
              if (target.roleName.toLowerCase() === "employee" && !target.isExplicitMapping) continue;
              // syncUserRole checks Logto and skips writes if already correct
              const result = await syncUserRole(user.mail!, user.jobTitle);
              if (result.status === "error") {
                console.warn(`[Directory Sync] Role sync error for ${user.mail}: ${result.detail}`);
              }
            } catch (err) {
              console.warn(`[Directory Sync] Role sync failed for ${user.mail}:`, err);
            }
          }
          console.log("[Directory Sync] Background role reconciliation complete");

          // ── Disable/Re-enable check: suspend users no longer in Entra ──
          try {
            // Build lookup structures keyed on the immutable Azure Object ID
            const activeEntraIds = new Set(flat.map((u) => u.id));
            const mailToEntraId = new Map(
              flat.filter((u) => u.mail).map((u) => [u.mail!.toLowerCase(), u.id])
            );
            // Fallback for users whose entraId hasn't been populated yet
            const activeEmails = new Set(
              usersWithEmail.map((u) => u.mail!.toLowerCase())
            );

            // Find all DB users who have logged in (non-directory stub)
            const dbUsers = await prisma.user.findMany({
              where: { NOT: { logtoId: { startsWith: "directory-" } } },
              select: { id: true, email: true, logtoId: true, disabledAt: true, entraId: true },
            });

            for (const dbUser of dbUsers) {
              const emailLower = dbUser.email.toLowerCase();

              // Backfill entraId from the current snapshot when not yet set.
              // Use a separate const so TypeScript can narrow it for the Prisma update.
              let entraId: string | null = dbUser.entraId;
              if (!entraId) {
                const candidate = mailToEntraId.get(emailLower) ?? null;
                if (candidate) {
                  try {
                    await prisma.user.update({
                      where: { id: dbUser.id },
                      data: { entraId: candidate },
                    });
                    entraId = candidate;
                  } catch {
                    // Ignore uniqueness conflicts — another row already owns this entraId
                  }
                }
              }

              // Prefer entraId match; fall back to email for users not yet backfilled
              const isInEntra = entraId
                ? activeEntraIds.has(entraId)
                : activeEmails.has(emailLower);

              if (!isInEntra && !dbUser.disabledAt) {
                try {
                  await suspendUser(dbUser.logtoId);
                  await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { disabledAt: new Date() },
                  });
                  console.log(`[Directory Sync] Suspended user: ${dbUser.email}`);
                } catch (err) {
                  console.warn(`[Directory Sync] Failed to suspend ${dbUser.email}:`, err);
                }
              } else if (isInEntra && dbUser.disabledAt) {
                try {
                  await unsuspendUser(dbUser.logtoId);
                  await prisma.user.update({
                    where: { id: dbUser.id },
                    data: { disabledAt: null },
                  });
                  console.log(`[Directory Sync] Re-enabled user: ${dbUser.email}`);
                } catch (err) {
                  console.warn(`[Directory Sync] Failed to unsuspend ${dbUser.email}:`, err);
                }
              }
            }
            console.log("[Directory Sync] Disable/re-enable check complete");
          } catch (err) {
            console.warn("[Directory Sync] Disable check failed:", err);
          }
        })();
      }
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
    WHERE department IS NOT NULL AND TRIM(department) <> ''
      AND job_title IS NOT NULL AND TRIM(job_title) <> ''
      AND UPPER(TRIM(COALESCE(office_location, ''))) <> 'EXCLUDE'
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
      business_phone AS "businessPhone",
      mobile_phone AS "mobilePhone",
      fax_number AS "faxNumber",
      manager_id AS "managerId"
    FROM directory_snapshots
    WHERE department IS NOT NULL AND TRIM(department) <> ''
      AND job_title IS NOT NULL AND TRIM(job_title) <> ''
      AND UPPER(TRIM(COALESCE(office_location, ''))) <> 'EXCLUDE'
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
    businessPhone: row.businessPhone,
    mobilePhone: row.mobilePhone,
    faxNumber: row.faxNumber,
    managerId: row.managerId,
  }));
}

// Root's direct reports for branch assignment. Unlike getSnapshotFlatUsers,
// this does NOT require department/job_title to be set — managing partners
// often have blank Entra titles. Only EXCLUDE'd office locations are skipped.
export async function getRootDirectReports(rootUserId: string): Promise<GraphUser[]> {
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
      business_phone AS "businessPhone",
      mobile_phone AS "mobilePhone",
      fax_number AS "faxNumber",
      manager_id AS "managerId"
    FROM directory_snapshots
    WHERE manager_id = ${rootUserId}
      AND UPPER(TRIM(COALESCE(office_location, ''))) <> 'EXCLUDE'
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
    businessPhone: row.businessPhone,
    mobilePhone: row.mobilePhone,
    faxNumber: row.faxNumber,
    managerId: row.managerId,
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
      business_phone AS "businessPhone",
      mobile_phone AS "mobilePhone",
      fax_number AS "faxNumber",
      manager_id AS "managerId"
    FROM directory_snapshots
    WHERE
      (department IS NOT NULL AND TRIM(department) <> '')
      AND (job_title IS NOT NULL AND TRIM(job_title) <> '')
      AND UPPER(TRIM(COALESCE(office_location, ''))) <> 'EXCLUDE'
      AND (
        display_name ILIKE ${query}
        OR COALESCE(mail, '') ILIKE ${query}
        OR user_principal_name ILIKE ${query}
      )
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
    businessPhone: row.businessPhone,
    mobilePhone: row.mobilePhone,
    faxNumber: row.faxNumber,
  }));
}

export async function getSnapshotUserById(id: string): Promise<GraphUser | null> {
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
      business_phone AS "businessPhone",
      mobile_phone AS "mobilePhone",
      fax_number AS "faxNumber",
      manager_id AS "managerId"
    FROM directory_snapshots
    WHERE id = ${id}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0];

  // Fetch direct reports so the profile dialog shows the same data as the directory page
  const reportRows = await prisma.$queryRaw<SnapshotRow[]>`
    SELECT
      id,
      display_name AS "displayName",
      mail,
      user_principal_name AS "userPrincipalName",
      job_title AS "jobTitle",
      employee_type AS "employeeType",
      department,
      office_location AS "officeLocation",
      business_phone AS "businessPhone",
      mobile_phone AS "mobilePhone",
      fax_number AS "faxNumber",
      manager_id AS "managerId"
    FROM directory_snapshots
    WHERE manager_id = ${id}
    ORDER BY display_name
  `;

  return {
    id: row.id,
    displayName: row.displayName,
    mail: row.mail,
    userPrincipalName: row.userPrincipalName,
    jobTitle: row.jobTitle,
    employeeType: row.employeeType,
    department: row.department,
    officeLocation: row.officeLocation,
    businessPhone: row.businessPhone,
    mobilePhone: row.mobilePhone,
    faxNumber: row.faxNumber,
    directReports: reportRows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      mail: r.mail,
      userPrincipalName: r.userPrincipalName,
      jobTitle: r.jobTitle,
      employeeType: r.employeeType,
      department: r.department,
      officeLocation: r.officeLocation,
      businessPhone: r.businessPhone,
      mobilePhone: r.mobilePhone,
      faxNumber: r.faxNumber,
      directReports: [],
    })),
  };
}

export async function getSnapshotTreeUsers(): Promise<GraphUser[]> {
  await ensureSnapshotTables();

  // The org chart is anchored at the configured root account. Everyone in the
  // root's reporting subtree is included; their branch grouping is derived from
  // directory_branch_assignments downstream.
  const config = await prisma.directoryConfig.findUnique({ where: { id: "singleton" } });
  const rootUserId = config?.rootUserId ?? null;

  if (rootUserId) {
    // Recursive walk down manager_id edges from the root. EXCLUDE'd nodes are
    // pruned along with their subtree (they never enter the CTE).
    const rows = await prisma.$queryRaw<SnapshotRow[]>`
      WITH RECURSIVE org_tree AS (
        SELECT * FROM directory_snapshots
        WHERE id = ${rootUserId}
          AND UPPER(TRIM(COALESCE(office_location, ''))) <> 'EXCLUDE'
        UNION ALL
        SELECT ds.* FROM directory_snapshots ds
        INNER JOIN org_tree ot ON ds.manager_id = ot.id
        WHERE UPPER(TRIM(COALESCE(ds.office_location, ''))) <> 'EXCLUDE'
      )
      SELECT
        id,
        display_name AS "displayName",
        mail,
        user_principal_name AS "userPrincipalName",
        job_title AS "jobTitle",
        employee_type AS "employeeType",
        department,
        office_location AS "officeLocation",
        business_phone AS "businessPhone",
        mobile_phone AS "mobilePhone",
        fax_number AS "faxNumber",
        manager_id AS "managerId"
      FROM org_tree
      ORDER BY display_name ASC
    `;
    return mapRowsToTree(rows);
  }

  // ── Fallback when no root account is configured yet ──
  // Show anyone with both department and job title so the chart isn't blank
  // before an admin sets the root in /admin/directory.
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
      business_phone AS "businessPhone",
      mobile_phone AS "mobilePhone",
      fax_number AS "faxNumber",
      manager_id AS "managerId"
    FROM directory_snapshots
    WHERE UPPER(TRIM(COALESCE(office_location, ''))) <> 'EXCLUDE'
      AND (
        department IS NOT NULL AND TRIM(department) <> ''
        AND job_title IS NOT NULL AND TRIM(job_title) <> ''
      )
    ORDER BY display_name ASC
  `;

  return mapRowsToTree(rows);
}

/* ── Branch data ─────────────────────────────────────────── */

export interface BranchData {
  id: string;
  name: string;
  sortOrder: number;
  memberIds: string[]; // Azure Object IDs of direct reports assigned to this branch
}

export interface DirectoryConfigData {
  rootUserId: string | null;
  rootEmail: string | null;
  rootName: string | null;
  sharedEmployeeTypes: string[];
}

export async function getDirectoryConfig(): Promise<DirectoryConfigData> {
  const config = await prisma.directoryConfig.findUnique({ where: { id: "singleton" } });
  return {
    rootUserId: config?.rootUserId ?? null,
    rootEmail: config?.rootEmail ?? null,
    rootName: config?.rootName ?? null,
    sharedEmployeeTypes: config?.sharedEmployeeTypes ?? [],
  };
}

// Distinct, non-empty employeeType values present in the snapshot — used to
// populate the admin "Shared Employee Types" picker and the directory filter.
export async function getDistinctEmployeeTypes(): Promise<string[]> {
  await ensureSnapshotTables();
  const rows = await prisma.$queryRaw<Array<{ employeeType: string }>>`
    SELECT DISTINCT TRIM(employee_type) AS "employeeType"
    FROM directory_snapshots
    WHERE employee_type IS NOT NULL AND TRIM(employee_type) <> ''
    ORDER BY 1 ASC
  `;
  return rows.map((r) => r.employeeType);
}

export async function getDirectoryBranches(): Promise<BranchData[]> {
  const branches = await prisma.directoryBranch.findMany({
    orderBy: { sortOrder: "asc" },
    include: { assignments: { select: { userId: true } } },
  });
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    sortOrder: b.sortOrder,
    memberIds: b.assignments.map((a) => a.userId),
  }));
}
