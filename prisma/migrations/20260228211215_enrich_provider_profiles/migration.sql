-- AlterTable
ALTER TABLE "dock_overrides" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "dock_slot_availability" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "docks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "automated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "avg_lead_days" DOUBLE PRECISION,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "official_name" TEXT,
ADD COLUMN     "profile_json" JSONB,
ADD COLUMN     "special_notes" TEXT,
ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "transport_type" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'DIRECT_SUPPLIER',
ADD COLUMN     "typical_volume" TEXT;

-- CreateTable
CREATE TABLE "provider_contacts" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,

    CONSTRAINT "provider_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_aliases" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "domain" TEXT,

    CONSTRAINT "provider_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_agency_links" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,

    CONSTRAINT "provider_agency_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_contacts_phone_idx" ON "provider_contacts"("phone");

-- CreateIndex
CREATE INDEX "provider_contacts_email_idx" ON "provider_contacts"("email");

-- CreateIndex
CREATE INDEX "provider_aliases_alias_idx" ON "provider_aliases"("alias");

-- CreateIndex
CREATE INDEX "provider_aliases_domain_idx" ON "provider_aliases"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "provider_agency_links_supplier_id_agency_id_key" ON "provider_agency_links"("supplier_id", "agency_id");

-- AddForeignKey
ALTER TABLE "provider_contacts" ADD CONSTRAINT "provider_contacts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_aliases" ADD CONSTRAINT "provider_aliases_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_agency_links" ADD CONSTRAINT "provider_agency_links_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_agency_links" ADD CONSTRAINT "provider_agency_links_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
