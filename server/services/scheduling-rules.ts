import { prisma } from "../db/client";
import { getMadridMidnight, getMadridEndOfDay, getMadridDateStr, getMadridDayOfWeek } from "../utils/madrid-date";
import { formatInTimeZone } from "date-fns-tz";

// ─── Interfaces ──────────────────────────────────────────────────────

export interface SchedulingRules {
  avoidConcurrency: { enabled: boolean; mode: "suggest" | "enforce" };
  maxSimultaneous: { enabled: boolean; count: number };
  dockBuffer: { enabled: boolean; minutes: number };
  sizePriority: { enabled: boolean; largeSlots: string[]; smallSlots: string[] };
  dailyConcentration: { enabled: boolean; threshold: number };
  dockDistribution: { enabled: boolean; largePreferred: string; smallPreferred: string };
  categoryPreferredTime: { enabled: boolean; map: Record<string, string> };
  minLeadTime: { enabled: boolean; hours: number };
}

export interface SlotEvaluation {
  allowed: boolean;
  warnings: string[];
  suggestion: string | null;
  score: number;
  suggestedTime?: string;
}

export interface AvailableSlot {
  date: string;
  slotStartTime: string;
  slotEndTime: string;
  pointsAvailable: number;
  docksAvailable: number;
}

export interface RankedSlot extends AvailableSlot {
  score: number;
  reason: string;
}

// ─── Cache ───────────────────────────────────────────────────────────

const RULES_CACHE_TTL_MS = 60 * 1000; // 1 minute
let rulesCache: { rules: SchedulingRules; expiresAt: number } | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────

async function getConfigValue(key: string): Promise<string | null> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

function parseBool(val: string | null, fallback: boolean): boolean {
  if (val === null) return fallback;
  return val === "true";
}

function parseInt10(val: string | null, fallback: number): number {
  if (val === null) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

function parseCSV(val: string | null, fallback: string[]): string[] {
  if (!val) return fallback;
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseJSON<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

// ─── Read all rules from AppConfig ───────────────────────────────────

export async function getSchedulingRules(): Promise<SchedulingRules> {
  if (rulesCache && Date.now() < rulesCache.expiresAt) {
    return rulesCache.rules;
  }

  // Batch-fetch all rule keys at once for performance
  const ruleKeys = [
    "rule_avoid_concurrency", "rule_avoid_concurrency_mode",
    "rule_max_simultaneous", "rule_max_simultaneous_count",
    "rule_dock_buffer", "dock_buffer_minutes",
    "rule_size_priority", "rule_size_priority_large_preferred_slots", "rule_size_priority_small_preferred_slots",
    "rule_daily_concentration_warning", "rule_daily_concentration_threshold",
    "rule_dock_distribution", "rule_dock_large_preferred", "rule_dock_small_preferred",
    "rule_category_preferred_time", "rule_category_preferred_map",
    "rule_min_lead_time", "rule_min_lead_time_hours",
  ];

  const rows = await prisma.appConfig.findMany({ where: { key: { in: ruleKeys } } });
  const configMap = new Map<string, string>();
  for (const row of rows) {
    configMap.set(row.key, row.value);
  }

  const get = (key: string) => configMap.get(key) ?? null;

  const rules: SchedulingRules = {
    avoidConcurrency: {
      enabled: parseBool(get("rule_avoid_concurrency"), false),
      mode: (get("rule_avoid_concurrency_mode") as "suggest" | "enforce") || "suggest",
    },
    maxSimultaneous: {
      enabled: parseBool(get("rule_max_simultaneous"), false),
      count: parseInt10(get("rule_max_simultaneous_count"), 2),
    },
    dockBuffer: {
      enabled: parseBool(get("rule_dock_buffer"), false),
      minutes: parseInt10(get("dock_buffer_minutes"), 15),
    },
    sizePriority: {
      enabled: parseBool(get("rule_size_priority"), false),
      largeSlots: parseCSV(get("rule_size_priority_large_preferred_slots"), ["08:00", "10:00"]),
      smallSlots: parseCSV(get("rule_size_priority_small_preferred_slots"), ["14:00", "16:00", "18:00"]),
    },
    dailyConcentration: {
      enabled: parseBool(get("rule_daily_concentration_warning"), false),
      threshold: parseInt10(get("rule_daily_concentration_threshold"), 4),
    },
    dockDistribution: {
      enabled: parseBool(get("rule_dock_distribution"), false),
      largePreferred: get("rule_dock_large_preferred") || "M1",
      smallPreferred: get("rule_dock_small_preferred") || "M3",
    },
    categoryPreferredTime: {
      enabled: parseBool(get("rule_category_preferred_time"), false),
      map: parseJSON<Record<string, string>>(get("rule_category_preferred_map"), {}),
    },
    minLeadTime: {
      enabled: parseBool(get("rule_min_lead_time"), false),
      hours: parseInt10(get("rule_min_lead_time_hours"), 24),
    },
  };

  rulesCache = { rules, expiresAt: Date.now() + RULES_CACHE_TTL_MS };
  return rules;
}

// ─── Clear cache (called after updates) ──────────────────────────────

export function clearRulesCache(): void {
  rulesCache = null;
}

// ─── Evaluate a proposed slot against active rules ───────────────────

export async function evaluateSlot(
  date: Date,
  slotStartTime: string,
  startUtc: Date,
  endUtc: Date,
  size: "S" | "M" | "L",
  category: string,
  dockId?: string
): Promise<SlotEvaluation> {
  const rules = await getSchedulingRules();
  const warnings: string[] = [];
  let allowed = true;
  let suggestion: string | null = null;
  let suggestedTime: string | undefined;
  let score = 100;

  const dateStart = getMadridMidnight(date);
  const dateEnd = getMadridEndOfDay(date);

  // ─── Rule 1: Avoid concurrency ─────────────────────────────────
  if (rules.avoidConcurrency.enabled) {
    const overlapping = await prisma.appointment.count({
      where: {
        confirmationStatus: { not: "cancelled" },
        startUtc: { lt: endUtc },
        endUtc: { gt: startUtc },
      },
    });

    if (overlapping > 0) {
      score -= 20;
      const nextFree = await findNextFreeTime(startUtc, endUtc);
      const nextTimeStr = nextFree ? formatInTimeZone(nextFree, "Europe/Madrid", "HH:mm") : null;
      warnings.push(
        `Hay ${overlapping} descarga${overlapping > 1 ? "s" : ""} activa${overlapping > 1 ? "s" : ""} en ese momento.${nextTimeStr ? ` Hora recomendada: ${nextTimeStr}` : ""}`
      );
      if (nextTimeStr) suggestedTime = nextTimeStr;

      if (rules.avoidConcurrency.mode === "enforce" && nextTimeStr) {
        allowed = false;
        suggestion = `Horario con menos concurrencia: ${nextTimeStr}`;
      }
    }
  }

  // ─── Rule 2: Max simultaneous ──────────────────────────────────
  if (rules.maxSimultaneous.enabled) {
    const concurrent = await prisma.appointment.count({
      where: {
        confirmationStatus: { not: "cancelled" },
        startUtc: { lt: endUtc },
        endUtc: { gt: startUtc },
      },
    });

    if (concurrent >= rules.maxSimultaneous.count) {
      score -= 30;
      const nextFree = await findNextFreeTime(startUtc, endUtc);
      const nextTimeStr = nextFree ? formatInTimeZone(nextFree, "Europe/Madrid", "HH:mm") : null;
      warnings.push(
        `Se alcanza el límite de ${rules.maxSimultaneous.count} descargas simultáneas.${nextTimeStr ? ` Próximo hueco: ${nextTimeStr}` : ""}`
      );
      if (nextTimeStr) suggestedTime = nextTimeStr;

      if (rules.avoidConcurrency.mode === "enforce") {
        allowed = false;
        suggestion = nextTimeStr ? `Próximo horario disponible: ${nextTimeStr}` : "No hay horario alternativo cercano";
      }
    }
  }

  // ─── Rule 4: Size priority ─────────────────────────────────────
  if (rules.sizePriority.enabled) {
    if (size === "L" && !rules.sizePriority.largeSlots.includes(slotStartTime)) {
      score -= 10;
      warnings.push(`Para entregas grandes recomendamos primera hora (${rules.sizePriority.largeSlots.join(", ")})`);
    } else if (size === "S" && !rules.sizePriority.smallSlots.includes(slotStartTime)) {
      score -= 5;
      warnings.push(`Para entregas pequeñas solemos usar franjas de tarde (${rules.sizePriority.smallSlots.join(", ")})`);
    }
  }

  // ─── Rule 5: Daily concentration ───────────────────────────────
  if (rules.dailyConcentration.enabled) {
    const dailyCount = await prisma.appointment.count({
      where: {
        slotDate: { gte: dateStart, lte: dateEnd },
        confirmationStatus: { not: "cancelled" },
      },
    });

    if (dailyCount >= rules.dailyConcentration.threshold) {
      score -= 15;
      // Find a lighter day within ±2 days
      const lighterDay = await findLighterDay(date, 2);
      const dayHint = lighterDay ? ` ${lighterDay} está más tranquilo` : "";
      warnings.push(`Ese día ya tiene ${dailyCount} citas.${dayHint}`);
      if (lighterDay) suggestion = `Día alternativo: ${lighterDay}`;
    }
  }

  // ─── Rule 6: Dock distribution ─────────────────────────────────
  if (rules.dockDistribution.enabled && dockId) {
    // This is informational — just affects score/suggestion
    const preferredCode = size === "L" ? rules.dockDistribution.largePreferred : rules.dockDistribution.smallPreferred;
    const dock = await prisma.dock.findUnique({ where: { id: dockId } });
    if (dock && dock.code !== preferredCode) {
      score -= 5;
      warnings.push(`Para entregas ${size === "L" ? "grandes" : "pequeñas"} el muelle preferido es ${preferredCode}`);
    }
  }

  // ─── Rule 7: Category preferred time ───────────────────────────
  if (rules.categoryPreferredTime.enabled && category) {
    const preferredHour = rules.categoryPreferredTime.map[category];
    if (preferredHour && slotStartTime !== preferredHour) {
      score -= 5;
      warnings.push(`Para ${category} solemos recomendar las ${preferredHour}`);
    }
  }

  // ─── Rule 8: Min lead time ─────────────────────────────────────
  if (rules.minLeadTime.enabled) {
    const hoursUntil = (startUtc.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < rules.minLeadTime.hours) {
      score -= 15;
      warnings.push(`Lo normal es reservar con al menos ${rules.minLeadTime.hours}h de antelación`);

      if (rules.avoidConcurrency.mode === "enforce") {
        allowed = false;
        suggestion = `Reserva con al menos ${rules.minLeadTime.hours}h de antelación`;
      }
    }
  }

  return {
    allowed,
    warnings,
    suggestion,
    score: Math.max(0, score),
    suggestedTime,
  };
}

// ─── Rank available slots (best first) ───────────────────────────────

export async function rankAvailableSlots(
  slots: AvailableSlot[],
  size: "S" | "M" | "L",
  category: string
): Promise<RankedSlot[]> {
  const rules = await getSchedulingRules();
  const ranked: RankedSlot[] = [];

  for (const slot of slots) {
    let score = 100;
    const reasons: string[] = [];

    // Size priority scoring
    if (rules.sizePriority.enabled) {
      if (size === "L" && rules.sizePriority.largeSlots.includes(slot.slotStartTime)) {
        score += 15;
        reasons.push("Franja ideal para entregas grandes");
      } else if (size === "S" && rules.sizePriority.smallSlots.includes(slot.slotStartTime)) {
        score += 10;
        reasons.push("Franja ideal para entregas pequeñas");
      } else if (size === "L" && !rules.sizePriority.largeSlots.includes(slot.slotStartTime)) {
        score -= 10;
      } else if (size === "S" && !rules.sizePriority.smallSlots.includes(slot.slotStartTime)) {
        score -= 5;
      }
    }

    // Category preferred time scoring
    if (rules.categoryPreferredTime.enabled && category) {
      const preferredHour = rules.categoryPreferredTime.map[category];
      if (preferredHour && slot.slotStartTime === preferredHour) {
        score += 10;
        reasons.push(`Horario habitual para ${category}`);
      }
    }

    // More capacity = better
    score += Math.min(slot.pointsAvailable * 2, 10);

    // More docks = better
    score += Math.min(slot.docksAvailable * 3, 9);

    // Check concurrency for this slot
    if (rules.avoidConcurrency.enabled || rules.maxSimultaneous.enabled) {
      const slotDate = new Date(slot.date + "T12:00:00Z");
      const [h, m] = slot.slotStartTime.split(":").map(Number);
      const approxStart = new Date(slot.date + `T${slot.slotStartTime}:00+01:00`);
      const approxEnd = new Date(slot.date + `T${slot.slotEndTime}:00+01:00`);

      const concurrent = await prisma.appointment.count({
        where: {
          confirmationStatus: { not: "cancelled" },
          startUtc: { lt: approxEnd },
          endUtc: { gt: approxStart },
        },
      });

      if (concurrent === 0) {
        score += 20;
        reasons.push("Sin descargas simultáneas");
      } else {
        score -= concurrent * 10;
        if (concurrent > 0) reasons.push(`${concurrent} descarga${concurrent > 1 ? "s" : ""} activa${concurrent > 1 ? "s" : ""}`);
      }
    }

    ranked.push({
      ...slot,
      score: Math.max(0, score),
      reason: reasons.length > 0 ? reasons.join(". ") : "Disponible",
    });
  }

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

// ─── Update rules (partial) ──────────────────────────────────────────

interface RuleUpdatePayload {
  avoidConcurrency?: Partial<SchedulingRules["avoidConcurrency"]>;
  maxSimultaneous?: Partial<SchedulingRules["maxSimultaneous"]>;
  dockBuffer?: Partial<SchedulingRules["dockBuffer"]>;
  sizePriority?: Partial<SchedulingRules["sizePriority"]>;
  dailyConcentration?: Partial<SchedulingRules["dailyConcentration"]>;
  dockDistribution?: Partial<SchedulingRules["dockDistribution"]>;
  categoryPreferredTime?: Partial<SchedulingRules["categoryPreferredTime"]>;
  minLeadTime?: Partial<SchedulingRules["minLeadTime"]>;
}

const RULE_KEY_MAP: Record<string, Array<{ field: string; key: string; serialize: (v: any) => string }>> = {
  avoidConcurrency: [
    { field: "enabled", key: "rule_avoid_concurrency", serialize: (v) => String(v) },
    { field: "mode", key: "rule_avoid_concurrency_mode", serialize: (v) => v },
  ],
  maxSimultaneous: [
    { field: "enabled", key: "rule_max_simultaneous", serialize: (v) => String(v) },
    { field: "count", key: "rule_max_simultaneous_count", serialize: (v) => String(v) },
  ],
  dockBuffer: [
    { field: "enabled", key: "rule_dock_buffer", serialize: (v) => String(v) },
    { field: "minutes", key: "dock_buffer_minutes", serialize: (v) => String(v) },
  ],
  sizePriority: [
    { field: "enabled", key: "rule_size_priority", serialize: (v) => String(v) },
    { field: "largeSlots", key: "rule_size_priority_large_preferred_slots", serialize: (v) => v.join(",") },
    { field: "smallSlots", key: "rule_size_priority_small_preferred_slots", serialize: (v) => v.join(",") },
  ],
  dailyConcentration: [
    { field: "enabled", key: "rule_daily_concentration_warning", serialize: (v) => String(v) },
    { field: "threshold", key: "rule_daily_concentration_threshold", serialize: (v) => String(v) },
  ],
  dockDistribution: [
    { field: "enabled", key: "rule_dock_distribution", serialize: (v) => String(v) },
    { field: "largePreferred", key: "rule_dock_large_preferred", serialize: (v) => v },
    { field: "smallPreferred", key: "rule_dock_small_preferred", serialize: (v) => v },
  ],
  categoryPreferredTime: [
    { field: "enabled", key: "rule_category_preferred_time", serialize: (v) => String(v) },
    { field: "map", key: "rule_category_preferred_map", serialize: (v) => JSON.stringify(v) },
  ],
  minLeadTime: [
    { field: "enabled", key: "rule_min_lead_time", serialize: (v) => String(v) },
    { field: "hours", key: "rule_min_lead_time_hours", serialize: (v) => String(v) },
  ],
};

export async function updateSchedulingRules(payload: RuleUpdatePayload): Promise<SchedulingRules> {
  for (const [ruleName, ruleUpdate] of Object.entries(payload)) {
    if (!ruleUpdate) continue;
    const mappings = RULE_KEY_MAP[ruleName];
    if (!mappings) continue;

    for (const mapping of mappings) {
      const value = (ruleUpdate as Record<string, any>)[mapping.field];
      if (value === undefined) continue;

      await prisma.appConfig.upsert({
        where: { key: mapping.key },
        update: { value: mapping.serialize(value) },
        create: { key: mapping.key, value: mapping.serialize(value) },
      });
    }
  }

  clearRulesCache();
  return getSchedulingRules();
}

// ─── Internal helpers ────────────────────────────────────────────────

const DAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/**
 * Find the next time window with fewer concurrent appointments.
 * Scans forward in 15-minute increments up to 4 hours.
 */
async function findNextFreeTime(startUtc: Date, endUtc: Date): Promise<Date | null> {
  const durationMs = endUtc.getTime() - startUtc.getTime();
  const maxSearchMs = 4 * 60 * 60 * 1000; // Search up to 4 hours ahead
  const stepMs = 15 * 60 * 1000; // 15-minute increments

  let bestTime: Date | null = null;
  let bestCount = Infinity;

  for (let offset = stepMs; offset <= maxSearchMs; offset += stepMs) {
    const candidateStart = new Date(startUtc.getTime() + offset);
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);

    const concurrent = await prisma.appointment.count({
      where: {
        confirmationStatus: { not: "cancelled" },
        startUtc: { lt: candidateEnd },
        endUtc: { gt: candidateStart },
      },
    });

    if (concurrent === 0) {
      return candidateStart;
    }

    if (concurrent < bestCount) {
      bestCount = concurrent;
      bestTime = candidateStart;
    }
  }

  return bestTime;
}

/**
 * Find a lighter day within ±range days of the target date.
 * Returns a formatted string like "martes 03/03".
 */
async function findLighterDay(targetDate: Date, range: number): Promise<string | null> {
  let bestDate: Date | null = null;
  let bestCount = Infinity;
  const targetMidnight = getMadridMidnight(targetDate);

  for (let i = -range; i <= range; i++) {
    if (i === 0) continue; // Skip target day

    const candidate = new Date(targetMidnight.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = getMadridDayOfWeek(candidate);

    // Skip Sundays
    if (dayOfWeek === 0) continue;

    const candStart = getMadridMidnight(candidate);
    const candEnd = getMadridEndOfDay(candidate);

    const count = await prisma.appointment.count({
      where: {
        slotDate: { gte: candStart, lte: candEnd },
        confirmationStatus: { not: "cancelled" },
      },
    });

    if (count < bestCount) {
      bestCount = count;
      bestDate = candidate;
    }
  }

  if (!bestDate) return null;

  const dayOfWeek = getMadridDayOfWeek(bestDate);
  const dayName = DAY_NAMES_ES[dayOfWeek];
  const formatted = formatInTimeZone(bestDate, "Europe/Madrid", "dd/MM");
  return `${dayName} ${formatted}`;
}
