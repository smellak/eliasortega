-- AlterTable: add provider contact and confirmation fields
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "provider_email" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "provider_phone" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "confirmation_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "confirmation_token" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "confirmation_sent_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

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
