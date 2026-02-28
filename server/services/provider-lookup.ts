/**
 * Provider Lookup Service
 *
 * Searches the provider database by phone, email, domain, alias, or name.
 * Returns enriched profiles for the chat agent to use as "soft knowledge".
 * Cached for 10 minutes to avoid repeated DB queries.
 */

import { prisma } from "../db/client";

export interface ProviderProfile {
  id: string;
  name: string;
  officialName: string | null;
  type: string;
  category: string | null;
  subcategory: string | null;
  transportType: string | null;
  typicalVolume: string | null;
  avgLeadDays: number | null;
  automated: boolean;
  specialNotes: string | null;
  contacts: Array<{
    name: string;
    email: string | null;
    phone: string | null;
    role: string | null;
  }>;
  aliases: string[];
  agencies: Array<{ name: string; type: string }>;
  suppliersServed: Array<{ name: string; type: string }>;
  samplePhrases: string[];
  referenceFormats: string | null;
  typicalUnits: string | null;
  unitType: string | null;
  deliveryFrequency: string | null;
}

// Cache: key -> { result, expiresAt }
const lookupCache = new Map<
  string,
  { result: ProviderProfile | null; expiresAt: number }
>();
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Normalize phone: strip spaces, dots, dashes, prefixes, +34 */
function normalizePhone(raw: string): string {
  let p = raw
    .replace(/^(Tel\.?|Telf\.?|fax:?)\s*/i, "")
    .replace(/[\s.\-()]/g, "");
  p = p.replace(/^(\+34|0034)/, "");
  return p;
}

export async function lookupProvider(query: {
  phone?: string;
  email?: string;
  name?: string;
}): Promise<ProviderProfile | null> {
  const cacheKey = JSON.stringify(query);
  const cached = lookupCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  let providerId: string | null = null;

  // Strategy 1: Lookup by phone
  if (query.phone) {
    const normalizedPhone = normalizePhone(query.phone);
    if (normalizedPhone.length >= 6) {
      const contact = await prisma.providerContact.findFirst({
        where: { phone: normalizedPhone },
        select: { providerId: true },
      });
      if (contact) providerId = contact.providerId;
    }
  }

  // Strategy 2: Lookup by email
  if (!providerId && query.email) {
    const email = query.email.toLowerCase().trim();

    // Exact email on contacts
    const contact = await prisma.providerContact.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { providerId: true },
    });
    if (contact) {
      providerId = contact.providerId;
    }

    if (!providerId) {
      // Email as alias (identifyByEmail entries)
      const alias = await prisma.providerAlias.findFirst({
        where: { alias: { equals: email, mode: "insensitive" } },
        select: { providerId: true },
      });
      if (alias) providerId = alias.providerId;
    }

    if (!providerId) {
      // Domain-based lookup
      const domain = email.split("@")[1];
      if (domain) {
        const domainAlias = await prisma.providerAlias.findFirst({
          where: { domain: { equals: domain.toLowerCase(), mode: "insensitive" } },
          select: { providerId: true },
        });
        if (domainAlias) providerId = domainAlias.providerId;
      }
    }
  }

  // Strategy 3: Lookup by name
  if (!providerId && query.name) {
    const name = query.name.trim();

    // Exact provider name
    const exact = await prisma.provider.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (exact) {
      providerId = exact.id;
    }

    if (!providerId) {
      // Alias exact match
      const alias = await prisma.providerAlias.findFirst({
        where: { alias: { equals: name, mode: "insensitive" } },
        select: { providerId: true },
      });
      if (alias) providerId = alias.providerId;
    }

    if (!providerId) {
      // Contains on provider name
      const partial = await prisma.provider.findFirst({
        where: { name: { contains: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (partial) providerId = partial.id;
    }

    if (!providerId) {
      // Contains on alias
      const aliasPartial = await prisma.providerAlias.findFirst({
        where: { alias: { contains: name, mode: "insensitive" } },
        select: { providerId: true },
      });
      if (aliasPartial) providerId = aliasPartial.providerId;
    }

    if (!providerId) {
      // Contains on officialName
      const official = await prisma.provider.findFirst({
        where: { officialName: { contains: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (official) providerId = official.id;
    }
  }

  if (!providerId) {
    lookupCache.set(cacheKey, { result: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  // Load full profile with relations
  const p = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      contacts: true,
      aliases: true,
      agencyLinks: { include: { agency: { select: { name: true, type: true } } } },
      supplierLinks: { include: { supplier: { select: { name: true, type: true } } } },
    },
  });

  if (!p) {
    lookupCache.set(cacheKey, { result: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const profileJson = (p.profileJson as Record<string, any>) || {};

  const profile: ProviderProfile = {
    id: p.id,
    name: p.name,
    officialName: p.officialName,
    type: p.type,
    category: p.category,
    subcategory: p.subcategory,
    transportType: p.transportType,
    typicalVolume: p.typicalVolume,
    avgLeadDays: p.avgLeadDays,
    automated: p.automated,
    specialNotes: p.specialNotes,
    contacts: p.contacts.map((c) => ({
      name: c.name,
      email: c.email,
      phone: c.phone,
      role: c.role,
    })),
    aliases: p.aliases.map((a) => a.alias),
    agencies: p.agencyLinks.map((l) => ({
      name: l.agency.name,
      type: l.agency.type,
    })),
    suppliersServed: p.supplierLinks.map((l) => ({
      name: l.supplier.name,
      type: l.supplier.type,
    })),
    samplePhrases: profileJson.samplePhrases || [],
    referenceFormats: profileJson.referenceFormats || null,
    typicalUnits: profileJson.typicalUnits || null,
    unitType: profileJson.unitType || null,
    deliveryFrequency: profileJson.deliveryFrequency || null,
  };

  lookupCache.set(cacheKey, { result: profile, expiresAt: Date.now() + CACHE_TTL_MS });
  return profile;
}
