import { prisma } from "../db/client";
import { formatInTimeZone } from "date-fns-tz";
import { getMadridDayOfWeek, getMadridMidnight, getMadridEndOfDay, getMadridDateStr } from "../utils/madrid-date";

type PrismaTransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface DockInfo {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

export interface SlotInfo {
  startTime: string;
  endTime: string;
  maxPoints: number;
  isOverride: boolean;
  reason?: string | null;
  activeDocks: number;
}

export interface SlotUsageInfo extends SlotInfo {
  pointsUsed: number;
  pointsAvailable: number;
  docksAvailable: number;
}

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const DAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export interface SlotValidationResult {
  valid: boolean;
  error?: string;
  reason?: "NO_POINTS" | "NO_DOCK" | "NO_SLOT";
  pointsUsed: number;
  maxPoints: number;
  pointsAvailable: number;
  slotStartTime: string;
  slotEndTime?: string;
  assignedDock?: DockInfo;
}

export interface SlotUsageResult {
  pointsUsed: number;
  appointments: Array<{ id: string; pointsUsed: number }>;
}

export class SlotCapacityValidator {
  private templateCache: Map<number, CacheEntry> = new Map();
  private bufferCache: { value: number; expiresAt: number } | null = null;
  private static CACHE_TTL_MS = 5 * 60 * 1000;

  private getClient(tx?: PrismaTransactionClient): PrismaTransactionClient {
    return tx || prisma;
  }

  clearCache(): void {
    this.templateCache.clear();
    this.bufferCache = null;
  }

  private async getCachedTemplates(dayOfWeek: number, client: PrismaTransactionClient) {
    const cached = this.templateCache.get(dayOfWeek);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
    const templates = await client.slotTemplate.findMany({
      where: { dayOfWeek, active: true },
      orderBy: { startTime: "asc" },
    });
    this.templateCache.set(dayOfWeek, {
      data: templates,
      expiresAt: Date.now() + SlotCapacityValidator.CACHE_TTL_MS,
    });
    return templates;
  }

  async getDockBufferMinutes(tx?: PrismaTransactionClient): Promise<number> {
    if (this.bufferCache && Date.now() < this.bufferCache.expiresAt) {
      return this.bufferCache.value;
    }
    const client = this.getClient(tx);
    const config = await client.appConfig.findUnique({
      where: { key: "dock_buffer_minutes" },
    });
    const value = config ? parseInt(config.value, 10) : 15;
    this.bufferCache = { value, expiresAt: Date.now() + SlotCapacityValidator.CACHE_TTL_MS };
    return value;
  }

  determineSizeFromDuration(durationMin: number): "S" | "M" | "L" {
    if (durationMin <= 30) return "S";
    if (durationMin <= 90) return "M";
    return "L";
  }

  getPointsForSize(size: "S" | "M" | "L"): number {
    switch (size) {
      case "S":
        return 1;
      case "M":
        return 2;
      case "L":
        return 3;
    }
  }

  determineSizeAndPoints(durationMin: number): { size: "S" | "M" | "L"; points: number } {
    const size = this.determineSizeFromDuration(durationMin);
    const points = this.getPointsForSize(size);
    return { size, points };
  }

  /**
   * Get active docks for a given date and slot.
   * Considers DockSlotAvailability (template-level) and DockOverrides (date-level).
   */
  async getActiveDocks(
    date: Date,
    slotStartTime: string,
    tx?: PrismaTransactionClient
  ): Promise<DockInfo[]> {
    const client = this.getClient(tx);
    const dayOfWeek = getMadridDayOfWeek(date);

    // Find the SlotTemplate for this day + time
    const template = await client.slotTemplate.findFirst({
      where: { dayOfWeek, startTime: slotStartTime, active: true },
    });

    if (!template) return [];

    // Get docks with availability for this template
    const availabilities = await client.dockSlotAvailability.findMany({
      where: { slotTemplateId: template.id, isActive: true },
      include: { dock: true },
    });

    // Start with docks that are globally active AND have active availability for this template
    const baseDocks = availabilities
      .filter((a) => a.dock.active)
      .map((a) => a.dock);

    // Apply DockOverrides for this specific date
    const dateStart = getMadridMidnight(date);
    const dateEnd = getMadridEndOfDay(date);

    const overrides = await client.dockOverride.findMany({
      where: {
        OR: [
          { date: { gte: dateStart, lte: dateEnd }, dateEnd: null },
          { date: { lte: dateEnd }, dateEnd: { gte: dateStart } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Build override map: dockId → isActive (first match wins = most recent due to orderBy)
    const overrideMap = new Map<string, boolean>();
    for (const ov of overrides) {
      if (!overrideMap.has(ov.dockId)) {
        overrideMap.set(ov.dockId, ov.isActive);
      }
    }

    // Apply overrides
    const activeDocks: DockInfo[] = [];
    for (const dock of baseDocks) {
      const overrideActive = overrideMap.get(dock.id);
      if (overrideActive === false) continue; // Override disables this dock
      activeDocks.push({
        id: dock.id,
        name: dock.name,
        code: dock.code,
        sortOrder: dock.sortOrder,
      });
    }

    // Also check if any override ENABLES a dock that wasn't in baseDocks
    // (e.g., dock disabled in template but enabled by override for this date)
    for (const [dockId, isActive] of Array.from(overrideMap.entries())) {
      if (isActive && !activeDocks.find((d) => d.id === dockId)) {
        const dock = await client.dock.findUnique({ where: { id: dockId } });
        if (dock && dock.active) {
          activeDocks.push({
            id: dock.id,
            name: dock.name,
            code: dock.code,
            sortOrder: dock.sortOrder,
          });
        }
      }
    }

    return activeDocks.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Find a free dock for the given time range.
   * Checks minute-level overlap with existing appointments + buffer time.
   */
  async findFreeDock(
    date: Date,
    slotStartTime: string,
    startUtc: Date,
    endUtc: Date,
    excludeId?: string,
    tx?: PrismaTransactionClient
  ): Promise<DockInfo | null> {
    const client = this.getClient(tx);
    const activeDocks = await this.getActiveDocks(date, slotStartTime, tx);

    if (activeDocks.length === 0) return null;

    const bufferMinutes = await this.getDockBufferMinutes(tx);
    const bufferMs = bufferMinutes * 60 * 1000;

    const dateStart = getMadridMidnight(date);
    const dateEnd = getMadridEndOfDay(date);

    // Check each dock for overlapping appointments
    const freeDocks: DockInfo[] = [];

    for (const dock of activeDocks) {
      const whereClause: any = {
        dockId: dock.id,
        slotDate: { gte: dateStart, lte: dateEnd },
        confirmationStatus: { not: "cancelled" },
        // Overlap check with buffer:
        // existing.startUtc < (newEnd + buffer) AND (existing.endUtc + buffer) > newStart
        startUtc: { lt: new Date(endUtc.getTime() + bufferMs) },
        endUtc: { gt: new Date(startUtc.getTime() - bufferMs) },
      };

      if (excludeId) {
        whereClause.NOT = { id: excludeId };
      }

      const conflictCount = await client.appointment.count({ where: whereClause });

      if (conflictCount === 0) {
        freeDocks.push(dock);
      }
    }

    if (freeDocks.length === 0) return null;

    return this.selectBestDock(freeDocks, date, tx);
  }

  /**
   * Select the best dock from a list of free docks.
   * Priority: fewest reservations today → lowest sortOrder.
   */
  async selectBestDock(
    freeDocks: DockInfo[],
    date: Date,
    tx?: PrismaTransactionClient
  ): Promise<DockInfo> {
    if (freeDocks.length === 1) return freeDocks[0];

    const client = this.getClient(tx);
    const dateStart = getMadridMidnight(date);
    const dateEnd = getMadridEndOfDay(date);

    const docksWithLoad = await Promise.all(
      freeDocks.map(async (dock) => {
        const count = await client.appointment.count({
          where: {
            dockId: dock.id,
            slotDate: { gte: dateStart, lte: dateEnd },
            confirmationStatus: { not: "cancelled" },
          },
        });
        return { ...dock, dailyCount: count };
      })
    );

    docksWithLoad.sort((a, b) => {
      if (a.dailyCount !== b.dailyCount) return a.dailyCount - b.dailyCount;
      return a.sortOrder - b.sortOrder;
    });

    return docksWithLoad[0];
  }

  /**
   * Count how many docks have at least some free time in a slot (for availability display).
   */
  async getDocksAvailableInSlot(
    date: Date,
    slotStartTime: string,
    tx?: PrismaTransactionClient
  ): Promise<number> {
    const activeDocks = await this.getActiveDocks(date, slotStartTime, tx);
    if (activeDocks.length === 0) return 0;

    const client = this.getClient(tx);
    const dateStart = getMadridMidnight(date);
    const dateEnd = getMadridEndOfDay(date);
    const slot = await this.findSlotForTime(date, slotStartTime, tx);
    if (!slot) return 0;

    // A dock is "available" if it has fewer active bookings than the slot's max points
    // (since each booking uses at least 1 point, a dock can't have more bookings than maxPoints)
    let availableCount = 0;
    for (const dock of activeDocks) {
      const bookings = await client.appointment.count({
        where: {
          dockId: dock.id,
          slotDate: { gte: dateStart, lte: dateEnd },
          slotStartTime: slot.startTime,
          confirmationStatus: { not: "cancelled" },
        },
      });
      // A dock is available if its booking count is less than the slot's max points
      if (bookings < slot.maxPoints) {
        availableCount++;
      }
    }
    return availableCount;
  }

  async getSlotsForDate(
    date: Date,
    tx?: PrismaTransactionClient
  ): Promise<SlotInfo[]> {
    const client = this.getClient(tx);

    const dayOfWeek = getMadridDayOfWeek(date);

    const templates = tx
      ? await client.slotTemplate.findMany({
          where: { dayOfWeek, active: true },
          orderBy: { startTime: "asc" },
        })
      : await this.getCachedTemplates(dayOfWeek, client);

    const dateStart = getMadridMidnight(date);
    const dateEnd = getMadridEndOfDay(date);

    const overrides = await client.slotOverride.findMany({
      where: {
        OR: [
          // Single-day override (no dateEnd): exact date match
          { date: { gte: dateStart, lte: dateEnd }, dateEnd: null },
          // Range override: date <= targetDate <= dateEnd
          { date: { lte: dateEnd }, dateEnd: { gte: dateStart } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Use first match (most recent) per key to avoid nondeterminism with duplicates
    const overrideMap = new Map<string, typeof overrides[number]>();
    for (const ov of overrides) {
      const key = ov.startTime || "__full_day__";
      if (!overrideMap.has(key)) {
        overrideMap.set(key, ov);
      }
    }

    const fullDayOverride = overrideMap.get("__full_day__");

    const slots: SlotInfo[] = [];

    for (const tpl of templates) {
      const specificOverride = overrideMap.get(tpl.startTime);
      let slotData: Omit<SlotInfo, "activeDocks">;

      if (specificOverride) {
        slotData = {
          startTime: specificOverride.startTime || tpl.startTime,
          endTime: specificOverride.endTime || tpl.endTime,
          maxPoints: specificOverride.maxPoints,
          isOverride: true,
          reason: specificOverride.reason,
        };
      } else if (fullDayOverride) {
        slotData = {
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          maxPoints: fullDayOverride.maxPoints,
          isOverride: true,
          reason: fullDayOverride.reason,
        };
      } else {
        slotData = {
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          maxPoints: tpl.maxPoints,
          isOverride: false,
        };
      }

      // If maxPoints is 0, no docks are available (slot is closed)
      let activeDockCount = 0;
      if (slotData.maxPoints > 0) {
        const activeDocks = await this.getActiveDocks(date, slotData.startTime, tx);
        activeDockCount = activeDocks.length;
      }

      slots.push({ ...slotData, activeDocks: activeDockCount });
    }

    return slots;
  }

  /**
   * Find which slot a given time falls into.
   * E.g., "09:23" falls within the "08:00"-"10:00" slot.
   */
  async findSlotForTime(
    date: Date,
    timeHHMM: string,
    tx?: PrismaTransactionClient
  ): Promise<SlotInfo | null> {
    const slots = await this.getSlotsForDate(date, tx);
    for (const slot of slots) {
      if (timeHHMM >= slot.startTime && timeHHMM < slot.endTime) {
        return slot;
      }
    }
    return null;
  }

  async getSlotUsage(
    date: Date,
    slotStartTime: string,
    excludeId?: string,
    tx?: PrismaTransactionClient
  ): Promise<number>;
  async getSlotUsage(
    date: Date,
    slotStartTime: string,
    excludeId: string | undefined,
    tx: PrismaTransactionClient | undefined,
    detailed: true
  ): Promise<SlotUsageResult>;
  async getSlotUsage(
    date: Date,
    slotStartTime: string,
    excludeId?: string,
    tx?: PrismaTransactionClient,
    detailed?: boolean
  ): Promise<number | SlotUsageResult> {
    const client = this.getClient(tx);

    const dateStart = getMadridMidnight(date);
    const dateEnd = getMadridEndOfDay(date);

    const whereClause: any = {
      slotDate: { gte: dateStart, lte: dateEnd },
      slotStartTime: slotStartTime,
      confirmationStatus: { not: "cancelled" },
    };

    if (excludeId) {
      whereClause.NOT = { id: excludeId };
    }

    const appointments = await client.appointment.findMany({
      where: whereClause,
      select: { id: true, pointsUsed: true },
    });

    const pointsUsed = appointments.reduce((sum, a) => sum + (a.pointsUsed || 0), 0);

    if (detailed) {
      return {
        pointsUsed,
        appointments: appointments.map((a) => ({ id: a.id, pointsUsed: a.pointsUsed || 0 })),
      };
    }

    return pointsUsed;
  }

  /**
   * Validate slot capacity with dual check: points AND dock availability.
   * startUtc/endUtc are the actual appointment times (for dock overlap checking).
   */
  async validateSlotCapacity(
    date: Date,
    slotStartTime: string,
    pointsNeeded: number,
    startUtc: Date,
    endUtc: Date,
    excludeId?: string,
    tx?: PrismaTransactionClient
  ): Promise<SlotValidationResult> {
    const slots = await this.getSlotsForDate(date, tx);
    let slot = slots.find((s) => s.startTime === slotStartTime);

    // If no exact match, try to find slot that contains this time
    if (!slot) {
      slot = slots.find(
        (s) => slotStartTime >= s.startTime && slotStartTime < s.endTime
      );
    }

    const dayOfWeek = getMadridDayOfWeek(date);
    const dayName = DAY_NAMES_ES[dayOfWeek];

    if (!slot) {
      return {
        valid: false,
        reason: "NO_SLOT",
        error: `No hay slot disponible para las ${slotStartTime} del ${dayName}`,
        pointsUsed: 0,
        maxPoints: 0,
        pointsAvailable: 0,
        slotStartTime,
      };
    }

    // FILTER 1: Check points capacity
    const pointsUsed = await this.getSlotUsage(date, slot.startTime, excludeId, tx);
    const pointsAvailable = slot.maxPoints - pointsUsed;

    if (pointsAvailable < pointsNeeded) {
      return {
        valid: false,
        reason: "NO_POINTS",
        error: `Slot ${slot.startTime}-${slot.endTime} lleno: ${pointsUsed}/${slot.maxPoints} puntos usados, necesitas ${pointsNeeded}`,
        pointsUsed,
        maxPoints: slot.maxPoints,
        pointsAvailable,
        slotStartTime: slot.startTime,
        slotEndTime: slot.endTime,
      };
    }

    // FILTER 2: Find a free physical dock
    const assignedDock = await this.findFreeDock(
      date, slot.startTime, startUtc, endUtc, excludeId, tx
    );

    if (!assignedDock) {
      return {
        valid: false,
        reason: "NO_DOCK",
        error: `Todos los muelles están ocupados de ${slot.startTime} a ${slot.endTime}. Prueba otro horario dentro de la franja.`,
        pointsUsed,
        maxPoints: slot.maxPoints,
        pointsAvailable,
        slotStartTime: slot.startTime,
        slotEndTime: slot.endTime,
      };
    }

    return {
      valid: true,
      pointsUsed,
      maxPoints: slot.maxPoints,
      pointsAvailable,
      slotStartTime: slot.startTime,
      slotEndTime: slot.endTime,
      assignedDock,
    };
  }

  /**
   * Resolve the correct slotStartTime for a given appointment start date.
   * Returns the slot's startTime (e.g., "08:00"), not the appointment's exact time.
   */
  async resolveSlotStartTime(
    startDate: Date,
    tx?: PrismaTransactionClient
  ): Promise<string | null> {
    const timeHHMM = formatInTimeZone(startDate, "Europe/Madrid", "HH:mm");
    const slot = await this.findSlotForTime(startDate, timeHHMM, tx);
    return slot ? slot.startTime : null;
  }

  async findAvailableSlots(
    startDate: Date,
    endDate: Date,
    pointsNeeded: number
  ): Promise<Array<{ date: string; slots: SlotUsageInfo[] }>> {
    const results: Array<{ date: string; slots: SlotUsageInfo[] }> = [];

    let current = getMadridMidnight(startDate);
    const end = getMadridEndOfDay(endDate);

    while (current <= end) {
      const slots = await this.getSlotsForDate(current);
      const availableSlots: SlotUsageInfo[] = [];

      for (const slot of slots) {
        const pointsUsed = await this.getSlotUsage(current, slot.startTime);
        const pointsAvailable = slot.maxPoints - pointsUsed;

        const docksAvailable = await this.getDocksAvailableInSlot(current, slot.startTime);

        if (pointsAvailable >= pointsNeeded && docksAvailable > 0) {
          availableSlots.push({
            ...slot,
            pointsUsed,
            pointsAvailable,
            docksAvailable,
          });
        }
      }

      if (availableSlots.length > 0) {
        results.push({
          date: getMadridDateStr(current),
          slots: availableSlots,
        });
      }

      // Use 25-hour increment to avoid DST edge cases, then re-align to midnight
      current = getMadridMidnight(new Date(current.getTime() + 25 * 60 * 60 * 1000));
    }

    return results;
  }
}

export const slotCapacityValidator = new SlotCapacityValidator();
