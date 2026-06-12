-- Add shared_employee_types to directory_config.
-- Employee types in this array are classified as "Shared" and are excluded
-- from branch grouping in the directory org chart.
ALTER TABLE "directory_config"
  ADD COLUMN IF NOT EXISTS "shared_employee_types" TEXT[] NOT NULL DEFAULT '{}';
