-- AlterTable
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slot_overrides' AND column_name = 'date_end') THEN
    ALTER TABLE "slot_overrides" ADD COLUMN "date_end" TIMESTAMP(3);
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "slot_overrides_date_end_idx" ON "slot_overrides"("date_end");
