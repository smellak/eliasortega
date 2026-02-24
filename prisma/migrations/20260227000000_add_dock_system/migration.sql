-- CreateTable: docks
CREATE TABLE "docks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "docks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "docks_code_key" ON "docks"("code");

-- CreateTable: dock_slot_availability
CREATE TABLE "dock_slot_availability" (
    "id" TEXT NOT NULL,
    "dock_id" TEXT NOT NULL,
    "slot_template_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dock_slot_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dock_slot_availability_dock_id_slot_template_id_key" ON "dock_slot_availability"("dock_id", "slot_template_id");

-- AddForeignKey
ALTER TABLE "dock_slot_availability" ADD CONSTRAINT "dock_slot_availability_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_slot_availability" ADD CONSTRAINT "dock_slot_availability_slot_template_id_fkey" FOREIGN KEY ("slot_template_id") REFERENCES "slot_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: dock_overrides
CREATE TABLE "dock_overrides" (
    "id" TEXT NOT NULL,
    "dock_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "date_end" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dock_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dock_overrides_dock_id_date_idx" ON "dock_overrides"("dock_id", "date");

-- CreateIndex
CREATE INDEX "dock_overrides_date_end_idx" ON "dock_overrides"("date_end");

-- AddForeignKey
ALTER TABLE "dock_overrides" ADD CONSTRAINT "dock_overrides_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: appointments - add dock_id
ALTER TABLE "appointments" ADD COLUMN "dock_id" TEXT;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "docks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "appointments_dock_id_slot_date_start_utc_end_utc_idx" ON "appointments"("dock_id", "slot_date", "start_utc", "end_utc");
