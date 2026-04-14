-- Rename spotlight user columns to consistent lowercase userid
DO $$
BEGIN
  -- video_spotlights
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlights' AND column_name='userid') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlights' AND column_name='userId') THEN
    ALTER TABLE video_spotlights RENAME COLUMN "userId" TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlights' AND column_name='user_id') THEN
    ALTER TABLE video_spotlights RENAME COLUMN user_id TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlights' AND column_name='authorId') THEN
    ALTER TABLE video_spotlights RENAME COLUMN "authorId" TO userid;
  END IF;

  -- video_spotlight_reactions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_reactions' AND column_name='userid') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_reactions' AND column_name='userId') THEN
    ALTER TABLE video_spotlight_reactions RENAME COLUMN "userId" TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_reactions' AND column_name='user_id') THEN
    ALTER TABLE video_spotlight_reactions RENAME COLUMN user_id TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_reactions' AND column_name='userLogtoId') THEN
    ALTER TABLE video_spotlight_reactions RENAME COLUMN "userLogtoId" TO userid;
  END IF;

  -- video_spotlight_comments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comments' AND column_name='userid') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comments' AND column_name='userId') THEN
    ALTER TABLE video_spotlight_comments RENAME COLUMN "userId" TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comments' AND column_name='user_id') THEN
    ALTER TABLE video_spotlight_comments RENAME COLUMN user_id TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comments' AND column_name='authorId') THEN
    ALTER TABLE video_spotlight_comments RENAME COLUMN "authorId" TO userid;
  END IF;

  -- video_spotlight_comment_likes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comment_likes' AND column_name='userid') THEN
    NULL;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comment_likes' AND column_name='userId') THEN
    ALTER TABLE video_spotlight_comment_likes RENAME COLUMN "userId" TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comment_likes' AND column_name='user_id') THEN
    ALTER TABLE video_spotlight_comment_likes RENAME COLUMN user_id TO userid;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='video_spotlight_comment_likes' AND column_name='voterLogtoId') THEN
    ALTER TABLE video_spotlight_comment_likes RENAME COLUMN "voterLogtoId" TO userid;
  END IF;
END $$;
