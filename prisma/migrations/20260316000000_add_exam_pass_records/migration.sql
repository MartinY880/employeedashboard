-- CreateTable
CREATE TABLE IF NOT EXISTS "exam_pass_records" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_pass_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "exam_pass_records_email_key" ON "exam_pass_records"("email");
CREATE INDEX IF NOT EXISTS "exam_pass_records_created_at_idx" ON "exam_pass_records"("created_at");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exam_pass_records_email_fkey') THEN
    ALTER TABLE "exam_pass_records" ADD CONSTRAINT "exam_pass_records_email_fkey"
      FOREIGN KEY ("email") REFERENCES "salesforce_directory"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
