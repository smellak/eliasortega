-- AlterTable
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'estimated_fields') THEN
    ALTER TABLE "appointments" ADD COLUMN "estimated_fields" TEXT;
  END IF;
END $$;
