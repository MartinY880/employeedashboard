-- AlterTable: ExamPassRecord → SalesforceDirectory FK: add ON DELETE CASCADE

ALTER TABLE "exam_pass_records"
  DROP CONSTRAINT IF EXISTS "exam_pass_records_email_fkey";

ALTER TABLE "exam_pass_records"
  ADD CONSTRAINT "exam_pass_records_email_fkey"
  FOREIGN KEY ("email") REFERENCES "salesforce_directory"("email")
  ON DELETE CASCADE ON UPDATE CASCADE;
