#!/usr/bin/env node
/**
 * Seed script — loads supplier/agency profiles from JSON into the database.
 * Idempotent: safe to run multiple times (upserts by name).
 *
 * Supports two JSON formats:
 *   1. Curated flat array: [{name, type, ...}, ...] (supplier-profiles-complete.json)
 *   2. Legacy grouped: {transport_agencies: [...], product_suppliers: [...]} (supplier-profiles.json)
 *
 * Usage: node seed-suppliers.cjs [path-to-json]
 * Default JSON path: data/supplier-profiles-complete.json
 * Fallback:          data/supplier-profiles.json
 * Requires: DATABASE_URL environment variable
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// --- Helpers ---

/** Normalize a phone number: strip spaces, dots, dashes, "Tel.", "Telf.", "fax:", leading +34 */
function normalizePhone(raw) {
  if (!raw) return null;
  let p = raw
    .replace(/^(Tel\.?|Telf\.?|fax:?)\s*/i, "")
    .replace(/[\s.\-()]/g, "");
  p = p.replace(/^(\+34|0034)/, "");
  if (!/^\d{6,}$/.test(p)) return null;
  return p;
}

/** Extract email domain */
function emailDomain(email) {
  if (!email) return null;
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/** Map category strings to normalized form for the calculator */
function normalizeCategory(cat) {
  if (!cat) return null;
  const map = {
    "electrodomésticos": "Electro",
    "electrodomesticos": "Electro",
    "electrodomésticos/pae": "Electro",
    "electro": "Electro",
    "colchonería": "Colchonería",
    "colchoneria": "Colchonería",
    "colchones": "Colchonería",
    "tapicería": "Tapicería",
    "tapiceria": "Tapicería",
    "sofás": "Tapicería",
    "mobiliario": "Mobiliario",
    "mobiliario/decoración": "Mobiliario",
    "muebles": "Mobiliario",
    "muebles kit": "Mobiliario",
    "cocina": "Cocina",
    "cocinas": "Cocina",
    "baño": "Baño",
    "asientos": "Asientos",
    "pae": "PAE",
    "climatización": "Electro",
    "importación marítima": null,
    "agencia transporte": null,
    "distribuidor local": null,
  };
  const lower = cat.toLowerCase().trim();
  return map[lower] !== undefined ? map[lower] : cat;
}

// --- Main seed logic ---

async function seedSuppliers(jsonPath) {
  console.log(`[seed-suppliers] Reading JSON from: ${jsonPath}`);
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);

  // Support both flat array and legacy grouped format
  let allEntities;
  if (Array.isArray(data)) {
    allEntities = data;
  } else {
    const agencies = data.transport_agencies || [];
    const suppliers = data.product_suppliers || data.direct_suppliers || [];
    allEntities = [...agencies, ...suppliers];
  }

  console.log(`[seed-suppliers] Found ${allEntities.length} entities`);

  // Phase 1: Create/update all Providers
  const providerMap = new Map(); // name -> { provider, entity }

  for (const entity of allEntities) {
    const providerType = entity.type || "DIRECT_SUPPLIER";
    const category = normalizeCategory(entity.category);
    // transportType: use explicit field or infer
    const transportType = entity.transportType || null;

    // Build profileJson with all useful raw data for the agent
    const profileJson = {
      aliases: entity.aliases || [],
      domains: entity.domains || [],
      identifyByEmail: entity.identifyByEmail || [],
      deliversFor: entity.deliversFor || [],
      usesAgencies: entity.usesAgencies || [],
      typicalData: entity.typicalData || {},
      samplePhrases: entity.samplePhrases || [],
      referenceFormats: entity.referenceFormats || null,
      address: entity.address || null,
      deliveryFrequency: entity.deliveryFrequency || null,
      typicalUnits: entity.typicalUnits || null,
      unitType: entity.unitType || null,
      vehicleType: entity.vehicleType || null,
      automated: entity.automated || false,
      automatedFormat: entity.automatedFormat || null,
      phase: entity.phase || null,
    };

    // Use specialNotes from JSON directly if present
    const specialNotes = entity.specialNotes || null;

    const upsertData = {
      officialName: entity.officialName || null,
      type: providerType,
      category: category,
      subcategory: entity.subcategory || null,
      transportType: transportType,
      typicalVolume: entity.typicalVolume || null,
      avgLeadDays: entity.avgLeadDays || null,
      automated: entity.automated === true,
      specialNotes: specialNotes,
      profileJson: profileJson,
    };

    const provider = await prisma.provider.upsert({
      where: { name: entity.name },
      update: upsertData,
      create: { name: entity.name, ...upsertData },
    });

    providerMap.set(entity.name, { provider, entity });
  }

  console.log(`[seed-suppliers] Upserted ${providerMap.size} providers`);

  // Phase 2: Create contacts
  let contactCount = 0;
  for (const [, { provider, entity }] of providerMap) {
    await prisma.providerContact.deleteMany({ where: { providerId: provider.id } });

    const contacts = entity.contacts || [];
    for (const contact of contacts) {
      const phone = normalizePhone(contact.phone);

      await prisma.providerContact.create({
        data: {
          providerId: provider.id,
          name: contact.name || entity.name,
          email: contact.email || null,
          phone: phone,
          role: contact.role || null,
        },
      });
      contactCount++;
    }
  }

  console.log(`[seed-suppliers] Created ${contactCount} contacts`);

  // Phase 3: Create aliases
  let aliasCount = 0;
  for (const [, { provider, entity }] of providerMap) {
    await prisma.providerAlias.deleteMany({ where: { providerId: provider.id } });

    const seenAliases = new Set();

    // Add explicit aliases
    for (const alias of (entity.aliases || [])) {
      const key = alias.toLowerCase().trim();
      if (seenAliases.has(key)) continue;
      seenAliases.add(key);

      let domain = null;
      if (alias.includes("@")) domain = emailDomain(alias);

      await prisma.providerAlias.create({
        data: { providerId: provider.id, alias, domain },
      });
      aliasCount++;
    }

    // Add domains as aliases (for domain-based lookup)
    for (const domain of (entity.domains || [])) {
      const key = domain.toLowerCase().trim();
      if (seenAliases.has(key)) continue;
      seenAliases.add(key);

      await prisma.providerAlias.create({
        data: { providerId: provider.id, alias: domain, domain: key },
      });
      aliasCount++;
    }

    // Add identifyByEmail addresses as aliases (for email-based lookup)
    for (const email of (entity.identifyByEmail || [])) {
      const key = email.toLowerCase().trim();
      if (seenAliases.has(key)) continue;
      seenAliases.add(key);

      const domain = emailDomain(email);
      await prisma.providerAlias.create({
        data: { providerId: provider.id, alias: email, domain },
      });
      aliasCount++;
    }
  }

  console.log(`[seed-suppliers] Created ${aliasCount} aliases`);

  // Phase 4: Create agency links
  let linkCount = 0;
  await prisma.providerAgencyLink.deleteMany({});

  for (const [, { provider, entity }] of providerMap) {
    // Agency that delivers for suppliers
    if (entity.type === "AGENCY" && entity.deliversFor) {
      for (const supplierName of entity.deliversFor) {
        const supplierEntry = providerMap.get(supplierName);
        if (supplierEntry) {
          try {
            await prisma.providerAgencyLink.create({
              data: { supplierId: supplierEntry.provider.id, agencyId: provider.id },
            });
            linkCount++;
          } catch (e) {
            if (!e.message?.includes("Unique constraint")) {
              console.warn(`[seed-suppliers] Link warning ${supplierName} -> ${entity.name}: ${e.message}`);
            }
          }
        }
      }
    }

    // Supplier/distributor that uses agencies
    if (entity.type !== "AGENCY" && entity.usesAgencies) {
      for (const agencyName of entity.usesAgencies) {
        const agencyEntry = providerMap.get(agencyName);
        if (agencyEntry) {
          try {
            await prisma.providerAgencyLink.create({
              data: { supplierId: provider.id, agencyId: agencyEntry.provider.id },
            });
            linkCount++;
          } catch (e) {
            if (!e.message?.includes("Unique constraint")) {
              console.warn(`[seed-suppliers] Link warning ${entity.name} -> ${agencyName}: ${e.message}`);
            }
          }
        }
      }
    }

    // LOCAL_DISTRIBUTOR that delivers for suppliers
    if ((entity.type === "LOCAL_DISTRIBUTOR" || entity.type === "IMPORT_PROCESS") && entity.deliversFor) {
      for (const supplierName of entity.deliversFor) {
        const supplierEntry = providerMap.get(supplierName);
        if (supplierEntry) {
          try {
            await prisma.providerAgencyLink.create({
              data: { supplierId: supplierEntry.provider.id, agencyId: provider.id },
            });
            linkCount++;
          } catch (e) {
            if (!e.message?.includes("Unique constraint")) {
              console.warn(`[seed-suppliers] Link warning ${supplierName} -> ${entity.name}: ${e.message}`);
            }
          }
        }
      }
    }
  }

  console.log(`[seed-suppliers] Created ${linkCount} agency-supplier links`);

  // Summary
  const providerCount = await prisma.provider.count();
  const contactTotal = await prisma.providerContact.count();
  const aliasTotal = await prisma.providerAlias.count();
  const linkTotal = await prisma.providerAgencyLink.count();

  console.log("\n[seed-suppliers] === SUMMARY ===");
  console.log(`  Providers:     ${providerCount}`);
  console.log(`  Contacts:      ${contactTotal}`);
  console.log(`  Aliases:       ${aliasTotal}`);
  console.log(`  Agency Links:  ${linkTotal}`);
  console.log("[seed-suppliers] Done!");
}

// --- Entry point ---

const jsonArg = process.argv[2];
const defaultPaths = [
  path.join(__dirname, "data", "supplier-profiles-complete.json"),
  path.join(__dirname, "data", "supplier-profiles.json"),
];

let jsonPath = jsonArg;
if (!jsonPath) {
  for (const p of defaultPaths) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      break;
    }
  }
}

if (!jsonPath || !fs.existsSync(jsonPath)) {
  console.error("[seed-suppliers] ERROR: No JSON file found. Pass path as argument or place file at data/supplier-profiles-complete.json");
  process.exit(1);
}

seedSuppliers(jsonPath)
  .catch(function (err) {
    console.error("[seed-suppliers] Error:", err);
    process.exit(1);
  })
  .finally(function () {
    return prisma.$disconnect();
  });
