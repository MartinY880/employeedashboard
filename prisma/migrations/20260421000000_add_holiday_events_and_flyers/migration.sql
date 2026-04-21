-- CreateTable: holiday_events
CREATE TABLE "holiday_events" (
    "id"          TEXT        NOT NULL,
    "holiday_id"  TEXT        NOT NULL,
    "startTime"   TIMESTAMP(3),
    "endTime"     TIMESTAMP(3),
    "location"    TEXT,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: holiday_flyers
CREATE TABLE "holiday_flyers" (
    "id"          TEXT        NOT NULL,
    "event_id"    TEXT        NOT NULL,
    "fileUrl"     TEXT        NOT NULL,
    "fileName"    TEXT        NOT NULL,
    "mimeType"    TEXT        NOT NULL DEFAULT 'application/pdf',
    "fileSize"    INTEGER     NOT NULL DEFAULT 0,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_flyers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holiday_events_holiday_id_key" ON "holiday_events"("holiday_id");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_flyers_event_id_key" ON "holiday_flyers"("event_id");

-- AddForeignKey
ALTER TABLE "holiday_events"
    ADD CONSTRAINT "holiday_events_holiday_id_fkey"
    FOREIGN KEY ("holiday_id") REFERENCES "holidays"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_flyers"
    ADD CONSTRAINT "holiday_flyers_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "holiday_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
