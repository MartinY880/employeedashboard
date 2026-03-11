-- Add separate phone columns to lender_account_executives
ALTER TABLE "lender_account_executives" ADD COLUMN "work_phone_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "lender_account_executives" ADD COLUMN "phone_extension" TEXT;
ALTER TABLE "lender_account_executives" ADD COLUMN "mobile_phone_number" TEXT;

-- Migrate existing data: parse the combined phone_number field
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

-- Extract extension
UPDATE "lender_account_executives"
SET "phone_extension" = (REGEXP_MATCHES(
  REGEXP_REPLACE("phone_number", '\|\s*m:.+$', ''),
  '\s*x(\d+)\s*$'
))[1]
WHERE "phone_number" ~ '\s*x\d+';

-- Make email default empty instead of required
ALTER TABLE "lender_account_executives" ALTER COLUMN "email" SET DEFAULT '';
ALTER TABLE "lender_account_executives" ALTER COLUMN "phone_number" SET DEFAULT '';
