DO $$ BEGIN
  ALTER TABLE "kudos_messages" ADD COLUMN "badge" TEXT NOT NULL DEFAULT 'mvp';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
