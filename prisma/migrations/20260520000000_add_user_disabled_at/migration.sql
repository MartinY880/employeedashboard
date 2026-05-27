-- Add disabled_at column to users for tracking Entra-disabled accounts
ALTER TABLE "users" ADD COLUMN "disabled_at" TIMESTAMP(3);
