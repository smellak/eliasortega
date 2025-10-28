-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PLANNER', 'BASIC_READONLY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BASIC_READONLY',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capacity_shifts" (
    "id" TEXT NOT NULL,
    "start_utc" TIMESTAMP(3) NOT NULL,
    "end_utc" TIMESTAMP(3) NOT NULL,
    "workers" INTEGER NOT NULL DEFAULT 0,
    "forklifts" INTEGER NOT NULL DEFAULT 0,
    "docks" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capacity_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT,
    "provider_name" TEXT NOT NULL,
    "start_utc" TIMESTAMP(3) NOT NULL,
    "end_utc" TIMESTAMP(3) NOT NULL,
    "work_minutes_needed" INTEGER NOT NULL,
    "forklifts_needed" INTEGER NOT NULL,
    "goods_type" TEXT,
    "units" INTEGER,
    "lines" INTEGER,
    "delivery_notes_count" INTEGER,
    "external_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "providers_name_key" ON "providers"("name");

-- CreateIndex
CREATE INDEX "capacity_shifts_start_utc_end_utc_idx" ON "capacity_shifts"("start_utc", "end_utc");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_external_ref_key" ON "appointments"("external_ref");

-- CreateIndex
CREATE INDEX "appointments_start_utc_idx" ON "appointments"("start_utc");

-- CreateIndex
CREATE INDEX "appointments_end_utc_idx" ON "appointments"("end_utc");

-- CreateIndex
CREATE INDEX "appointments_provider_name_idx" ON "appointments"("provider_name");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
