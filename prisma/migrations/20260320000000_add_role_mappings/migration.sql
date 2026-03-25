-- CreateTable
CREATE TABLE IF NOT EXISTS "role_mappings" (
    "id" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "logto_role_name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "role_mapping_exclusions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_mapping_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "role_mappings_job_title_key" ON "role_mappings"("job_title");
CREATE UNIQUE INDEX IF NOT EXISTS "role_mapping_exclusions_email_key" ON "role_mapping_exclusions"("email");
