-- Add icon_id column to preferred_vendors for icon fallback when no logo
ALTER TABLE "preferred_vendors" ADD COLUMN IF NOT EXISTS "icon_id" TEXT;
