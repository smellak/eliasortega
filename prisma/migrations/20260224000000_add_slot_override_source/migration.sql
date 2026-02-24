-- AlterTable
ALTER TABLE "slot_overrides" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
