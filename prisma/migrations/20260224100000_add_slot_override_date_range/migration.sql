-- AlterTable
ALTER TABLE "slot_overrides" ADD COLUMN IF NOT EXISTS "date_end" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "slot_overrides_date_end_idx" ON "slot_overrides"("date_end");
