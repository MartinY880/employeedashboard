-- Add thumbnailFilename to flyers for server-side rendered PDF thumbnails.
-- Nullable: only PDFs get a thumbnail (a pdftoppm-rendered PNG); image flyers leave it NULL.
ALTER TABLE "flyers" ADD COLUMN "thumbnailFilename" TEXT;
