-- Speed up case-insensitive directory lookups.
--
-- directory_snapshots holds the full company directory and is queried on nearly
-- every dashboard load with Prisma `mode: "insensitive"` (which generates ILIKE)
-- on `mail`, `user_principal_name`, and `display_name`. Without a matching index,
-- each of those is a full sequential scan — fine on a tiny dev DB, but on a
-- production-sized directory under concurrent load it pegs the CPU.
--
-- A pg_trgm GIN index lets ILIKE use an index, turning those scans into fast
-- index lookups. No query changes required.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "directory_snapshots_mail_trgm_idx"
  ON "directory_snapshots" USING gin (mail gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "directory_snapshots_upn_trgm_idx"
  ON "directory_snapshots" USING gin (user_principal_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "directory_snapshots_display_name_trgm_idx"
  ON "directory_snapshots" USING gin (display_name gin_trgm_ops);
