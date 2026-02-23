-- AlterTable
ALTER TABLE "slot_overrides" ADD COLUMN "date_end" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "slot_overrides_date_end_idx" ON "slot_overrides"("date_end");
