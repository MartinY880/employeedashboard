-- Add CELEBRATION_COMMENT and CELEBRATION_REPLY to NotificationType enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CELEBRATION_COMMENT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'CELEBRATION_COMMENT';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CELEBRATION_REPLY' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'CELEBRATION_REPLY';
  END IF;
END $$;
