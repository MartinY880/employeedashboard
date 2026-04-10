CREATE TABLE IF NOT EXISTS "lender_account_executives" (
  "id" TEXT NOT NULL,
  "lender_name" TEXT NOT NULL,
  "account_executive_name" TEXT NOT NULL,
  "phone_number" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lender_account_executives_pkey" PRIMARY KEY ("id")
);

-- Only create these indexes if lender_name column still exists.
-- On DBs migrated via safe-migration scripts, lender_name was already
-- replaced by lender_id FK before Prisma took over, so we skip here.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lender_account_executives' AND column_name = 'lender_name'
  ) THEN
    CREATE INDEX IF NOT EXISTS "lender_account_executives_active_lender_name_idx"
      ON "lender_account_executives"("active", "lender_name");

    CREATE INDEX IF NOT EXISTS "lender_account_executives_lender_name_sort_order_idx"
      ON "lender_account_executives"("lender_name", "sort_order");
  END IF;
END $$;
