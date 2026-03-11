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

CREATE INDEX IF NOT EXISTS "lender_account_executives_active_lender_name_idx"
ON "lender_account_executives"("active", "lender_name");

CREATE INDEX IF NOT EXISTS "lender_account_executives_lender_name_sort_order_idx"
ON "lender_account_executives"("lender_name", "sort_order");
