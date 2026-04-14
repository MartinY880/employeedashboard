-- Rename spotlight user columns from userid to snake_case user_id
-- Handles both dev (userid) and prod (userid from previous migration)
DO $$
BEGIN
  -- video_spotlights
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlights' AND column_name='user_id') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlights' AND column_name='userid') THEN
    ALTER TABLE video_spotlights RENAME COLUMN userid TO user_id;
  END IF;

  -- video_spotlight_reactions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_reactions' AND column_name='user_id') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_reactions' AND column_name='userid') THEN
    ALTER TABLE video_spotlight_reactions RENAME COLUMN userid TO user_id;
  END IF;

  -- video_spotlight_comments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comments' AND column_name='user_id') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comments' AND column_name='userid') THEN
    ALTER TABLE video_spotlight_comments RENAME COLUMN userid TO user_id;
  END IF;

  -- video_spotlight_comment_likes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comment_likes' AND column_name='user_id') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comment_likes' AND column_name='userid') THEN
    ALTER TABLE video_spotlight_comment_likes RENAME COLUMN userid TO user_id;
  END IF;
END $$;
