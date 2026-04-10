-- Add separate phone columns to lender_account_executives
DO $$ BEGIN
  ALTER TABLE "lender_account_executives" ADD COLUMN "work_phone_number" TEXT NOT NULL DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "lender_account_executives" ADD COLUMN "phone_extension" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "lender_account_executives" ADD COLUMN "mobile_phone_number" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Backfill phone columns from old combined phone_number field.
-- Skipped if work_phone_number already has data (migrate-safe.sh already did this).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lender_account_executives' AND column_name = 'phone_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM "lender_account_executives" WHERE "work_phone_number" != '' LIMIT 1
  ) THEN
    -- Extract mobile from "... | m:MOBILE"
    UPDATE "lender_account_executives"
    SET "mobile_phone_number" = TRIM(SUBSTRING("phone_number" FROM '\|\s*m:(.+)$'))
    WHERE "phone_number" ~ '\|\s*m:';

    -- Extract work phone (everything before "| m:" and before "x" extension)
    UPDATE "lender_account_executives"
    SET "work_phone_number" = TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE("phone_number", '\|\s*m:.+$', ''),
      '\s*x\d+\s*$', ''
    ))
    WHERE "phone_number" != '' AND "phone_number" NOT LIKE '| m:%';

    -- Extract extension (regexp_match is scalar, safe in UPDATE)
    UPDATE "lender_account_executives"
    SET "phone_extension" = (regexp_match(
      REGEXP_REPLACE("phone_number", '\|\s*m:.+$', ''),
      '\s*x(\d+)\s*$'
    ))[1]
    WHERE "phone_number" ~ '\s*x\d+';
  END IF;
END $$;

-- Make email default empty instead of required
ALTER TABLE "lender_account_executives" ALTER COLUMN "email" SET DEFAULT '';
ALTER TABLE "lender_account_executives" ALTER COLUMN "phone_number" SET DEFAULT '';
