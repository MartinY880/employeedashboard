-- CreateTable: lenders
CREATE TABLE IF NOT EXISTS "lenders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique lender name
CREATE UNIQUE INDEX IF NOT EXISTS "lenders_name_key" ON "lenders"("name");

-- Guard all lender_name-dependent steps: on DBs set up via safe-migration scripts,
-- lender_name was already replaced by lender_id before Prisma took over.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lender_account_executives' AND column_name = 'lender_name'
  ) THEN
    -- Migrate existing data: create lender records from distinct lender_name values
    INSERT INTO "lenders" ("id", "name", "updated_at")
    SELECT
        gen_random_uuid()::text,
        t.lender_name,
        NOW()
    FROM (SELECT DISTINCT lender_name FROM "lender_account_executives") t
    ON CONFLICT ("name") DO NOTHING;

    -- Add lender_id column to lender_account_executives
    ALTER TABLE "lender_account_executives" ADD COLUMN IF NOT EXISTS "lender_id" TEXT;

    -- Populate lender_id from matching lender names
    UPDATE "lender_account_executives" ae
    SET "lender_id" = l."id"
    FROM "lenders" l
    WHERE ae."lender_name" = l."name";

    -- Make lender_id NOT NULL
    ALTER TABLE "lender_account_executives" ALTER COLUMN "lender_id" SET NOT NULL;

    -- Drop old lender_name column
    ALTER TABLE "lender_account_executives" DROP COLUMN IF EXISTS "lender_name";

    -- Drop old indexes
    DROP INDEX IF EXISTS "lender_account_executives_active_lender_name_idx";
    DROP INDEX IF EXISTS "lender_account_executives_lender_name_sort_order_idx";
  END IF;

  -- Add FK constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'lender_account_executives_lender_id_fkey'
  ) THEN
    ALTER TABLE "lender_account_executives"
        ADD CONSTRAINT "lender_account_executives_lender_id_fkey"
        FOREIGN KEY ("lender_id") REFERENCES "lenders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex: new indexes
CREATE INDEX IF NOT EXISTS "lender_account_executives_active_lender_id_idx"
    ON "lender_account_executives"("active", "lender_id");

CREATE INDEX IF NOT EXISTS "lender_account_executives_lender_id_sort_order_idx"
    ON "lender_account_executives"("lender_id", "sort_order");
