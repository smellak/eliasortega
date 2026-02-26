-- Add actual timing fields to appointments for warehouse check-in/check-out
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "actual_start_utc" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "actual_end_utc" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "actual_units" INTEGER;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "checked_in_by" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "checked_out_by" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "actual_duration_min" DOUBLE PRECISION;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "prediction_error_min" DOUBLE PRECISION;

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS "appointments_actual_start_utc_idx" ON "appointments"("actual_start_utc");

-- Calibration snapshots table for coefficient recalibration history
CREATE TABLE IF NOT EXISTS "calibration_snapshots" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "new_td" DOUBLE PRECISION NOT NULL,
    "new_ta" DOUBLE PRECISION NOT NULL,
    "new_tl" DOUBLE PRECISION NOT NULL,
    "new_tu" DOUBLE PRECISION NOT NULL,
    "old_td" DOUBLE PRECISION NOT NULL,
    "old_ta" DOUBLE PRECISION NOT NULL,
    "old_tl" DOUBLE PRECISION NOT NULL,
    "old_tu" DOUBLE PRECISION NOT NULL,
    "mae_old" DOUBLE PRECISION NOT NULL,
    "mae_new" DOUBLE PRECISION NOT NULL,
    "applied_at" TIMESTAMP(3),
    "applied_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "calibration_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calibration_snapshots_category_idx" ON "calibration_snapshots"("category");
CREATE INDEX IF NOT EXISTS "calibration_snapshots_status_idx" ON "calibration_snapshots"("status");
