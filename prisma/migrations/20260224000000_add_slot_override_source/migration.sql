-- AlterTable
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'slot_overrides' AND column_name = 'source') THEN
    ALTER TABLE "slot_overrides" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
  END IF;
END $$;
