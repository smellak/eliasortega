-- AlterTable: add provider contact and confirmation fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'provider_email') THEN
    ALTER TABLE "appointments" ADD COLUMN "provider_email" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'provider_phone') THEN
    ALTER TABLE "appointments" ADD COLUMN "provider_phone" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmation_status') THEN
    ALTER TABLE "appointments" ADD COLUMN "confirmation_status" TEXT NOT NULL DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmation_token') THEN
    ALTER TABLE "appointments" ADD COLUMN "confirmation_token" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmation_sent_at') THEN
    ALTER TABLE "appointments" ADD COLUMN "confirmation_sent_at" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'reminder_sent_at') THEN
    ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'confirmed_at') THEN
    ALTER TABLE "appointments" ADD COLUMN "confirmed_at" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'cancelled_at') THEN
    ALTER TABLE "appointments" ADD COLUMN "cancelled_at" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'cancellation_reason') THEN
    ALTER TABLE "appointments" ADD COLUMN "cancellation_reason" TEXT;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_confirmation_token_key" ON "appointments"("confirmation_token");
CREATE INDEX IF NOT EXISTS "appointments_confirmation_status_idx" ON "appointments"("confirmation_status");

-- CreateTable: AppConfig for system settings
CREATE TABLE IF NOT EXISTS "app_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);
