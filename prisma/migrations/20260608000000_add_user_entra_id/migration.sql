-- Add entra_id column to users for stable Azure Object ID identity.
-- Nullable so all existing rows are preserved; backfilled during directory sync.
-- PostgreSQL UNIQUE indexes allow multiple NULLs, so no partial index needed.
ALTER TABLE "users" ADD COLUMN "entra_id" TEXT;
CREATE UNIQUE INDEX "users_entra_id_key" ON "users"("entra_id");
