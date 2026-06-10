-- Add thumbnail_url to holiday_flyers for server-side rendered PDF thumbnails.
-- Nullable: only PDFs get a thumbnail (a pdftoppm-rendered PNG); image flyers leave it NULL.
ALTER TABLE "holiday_flyers" ADD COLUMN "thumbnail_url" TEXT;
