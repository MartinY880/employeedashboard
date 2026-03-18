-- CreateTable
CREATE TABLE IF NOT EXISTS "salesforce_directory" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "birthday" DATE,
    "employment_start_date" DATE,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salesforce_directory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "salesforce_directory_email_key" ON "salesforce_directory"("email");
CREATE INDEX IF NOT EXISTS "salesforce_directory_email_idx" ON "salesforce_directory"("email");
CREATE INDEX IF NOT EXISTS "salesforce_directory_birthday_idx" ON "salesforce_directory"("birthday");
CREATE INDEX IF NOT EXISTS "salesforce_directory_employment_start_date_idx" ON "salesforce_directory"("employment_start_date");
