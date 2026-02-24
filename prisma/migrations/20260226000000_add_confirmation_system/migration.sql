-- AlterTable: add provider contact and confirmation fields
ALTER TABLE "appointments" ADD COLUMN "provider_email" TEXT;
ALTER TABLE "appointments" ADD COLUMN "provider_phone" TEXT;
ALTER TABLE "appointments" ADD COLUMN "confirmation_status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "appointments" ADD COLUMN "confirmation_token" TEXT;
ALTER TABLE "appointments" ADD COLUMN "confirmation_sent_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "confirmed_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN "cancellation_reason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_confirmation_token_key" ON "appointments"("confirmation_token");
CREATE INDEX "appointments_confirmation_status_idx" ON "appointments"("confirmation_status");

-- CreateTable: AppConfig for system settings
CREATE TABLE "app_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);
