/**
 * ProConnect — Database Seed & Schema Setup
 *
 * Entry point that:
 *   1. Detects whether the database is empty (fresh)
 *   2. If fresh AND proconnect_backup.sql exists → restores the full backup
 *   3. Runs Prisma migrations to apply any newer migrations on top
 *   4. Upserts default singleton rows
 *
 * Usage:
 *   npx tsx prisma/seed.ts            # auto-detect: restore backup if fresh, then migrate
 *   npx tsx prisma/seed.ts --restore  # force restore from backup (drops & recreates data)
 *
 * Or via npm:
 *   npm run db:setup
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL is not set. Aborting.");
  process.exit(1);
}

const BACKUP_FILE = resolve(__dirname, "../proconnect_backup.sql");
const forceRestore = process.argv.includes("--restore");

// ─── Helpers ─────────────────────────────────────────────────────

/** Parse DATABASE_URL into psql-compatible connection args */
function psqlArgs(): string {
  const url = new URL(connectionString!);
  const host = url.hostname;
  const port = url.port || "5432";
  const user = url.username;
  const pass = url.password;
  const db = url.pathname.replace(/^\//, "");
  // PGPASSWORD is set as an env var so psql doesn't prompt
  const env = pass ? `PGPASSWORD=${pass}` : "";
  return `${env} psql -h ${host} -p ${port} -U ${user} -d ${db}`;
}

/** Check if the _prisma_migrations table exists (proxy for "has schema been set up") */
async function isDatabaseEmpty(pool: pg.Pool): Promise<boolean> {
  try {
    const res = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
       ) AS has_migrations`
    );
    return !res.rows[0].has_migrations;
  } catch {
    return true; // connection error → treat as empty
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const pool = new pg.Pool({ connectionString });

  try {
    // ── Step 1: Restore backup if applicable ──────────────────────
    const backupExists = existsSync(BACKUP_FILE);
    const dbEmpty = await isDatabaseEmpty(pool);

    if (backupExists && (dbEmpty || forceRestore)) {
      const mode = forceRestore ? "(forced)" : "(fresh database detected)";
      console.log(`📦 Restoring from proconnect_backup.sql ${mode}...`);

      try {
        // Use psql to execute the SQL dump.
        // ON_ERROR_STOP=0 so pre-existing objects don't abort the restore.
        execSync(
          `${psqlArgs()} -v ON_ERROR_STOP=0 -f "${BACKUP_FILE}"`,
          { stdio: "inherit", shell: "/bin/bash" }
        );
        console.log("✅ Backup restored successfully.");
      } catch (err) {
        console.warn("⚠️  Backup restore completed with warnings (some objects may have already existed).");
      }
    } else if (!backupExists) {
      console.log("ℹ️  No proconnect_backup.sql found — skipping restore.");
    } else {
      console.log("ℹ️  Database already has data — skipping restore. Use --restore to force.");
    }

    // ── Step 2: Apply Prisma migrations ───────────────────────────
    console.log("🔄 Applying Prisma migrations...");
    try {
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("✅ Migrations applied successfully.");
    } catch (err) {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    }

    // ── Step 3: Seed default singleton data ───────────────────────
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
      console.log("🌱 Seeding default data...");

      await prisma.siteBranding.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton", companyName: "MortgagePros" },
      });
      console.log("  ✓ SiteBranding singleton");

      await prisma.calendarSetting.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton", data: "{}" },
      });
      console.log("  ✓ CalendarSetting singleton");

      await prisma.directorySnapshotState.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton" },
      });
      console.log("  ✓ DirectorySnapshotState singleton");

      console.log("✅ Seeding complete.");
    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    console.error("❌ Setup failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
