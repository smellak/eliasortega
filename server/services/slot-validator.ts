import { prisma } from "../db/client";
import { formatInTimeZone } from "date-fns-tz";

type PrismaTransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface SlotInfo {
  startTime: string;
  endTime: string;
  maxPoints: number;
  isOverride: boolean;
  reason?: string | null;
}

export interface SlotUsageInfo extends SlotInfo {
  pointsUsed: number;
  pointsAvailable: number;
}

interface CacheEntry {
  data: any;
  expiresAt: number;
}

const DAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export interface SlotValidationResult {
  valid: boolean;
  error?: string;
  pointsUsed: number;
  maxPoints: number;
  pointsAvailable: number;
  slotStartTime: string;
  slotEndTime?: string;
}

export interface SlotUsageResult {
  pointsUsed: number;
  appointments: Array<{ id: string; pointsUsed: number }>;
}

export class SlotCapacityValidator {
  private templateCache: Map<number, CacheEntry> = new Map();
  private static CACHE_TTL_MS = 5 * 60 * 1000;

  private getClient(tx?: PrismaTransactionClient): PrismaTransactionClient {
    return tx || prisma;
  }

  clearCache(): void {
    this.templateCache.clear();
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

  async getSlotsForDate(
    date: Date,
    tx?: PrismaTransactionClient
  ): Promise<SlotInfo[]> {
    const client = this.getClient(tx);

    const dayOfWeek = date.getDay();

    const templates = tx
      ? await client.slotTemplate.findMany({
          where: { dayOfWeek, active: true },
          orderBy: { startTime: "asc" },
        })
      : await this.getCachedTemplates(dayOfWeek, client);

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const overrides = await client.slotOverride.findMany({
      where: {
        date: { gte: dateStart, lte: dateEnd },
      },
    });

    const overrideMap = new Map<string, typeof overrides[number]>();
    for (const ov of overrides) {
      const key = ov.startTime || "__full_day__";
      overrideMap.set(key, ov);
    }

    const fullDayOverride = overrideMap.get("__full_day__");

    const slots: SlotInfo[] = [];

    for (const tpl of templates) {
      const specificOverride = overrideMap.get(tpl.startTime);

      if (specificOverride) {
        slots.push({
          startTime: specificOverride.startTime || tpl.startTime,
          endTime: specificOverride.endTime || tpl.endTime,
          maxPoints: specificOverride.maxPoints,
          isOverride: true,
          reason: specificOverride.reason,
        });
      } else if (fullDayOverride) {
        slots.push({
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          maxPoints: fullDayOverride.maxPoints,
          isOverride: true,
          reason: fullDayOverride.reason,
        });
      } else {
        slots.push({
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          maxPoints: tpl.maxPoints,
          isOverride: false,
        });
      }
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

    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(date);
    dateEnd.setHours(23, 59, 59, 999);

    const whereClause: any = {
      slotDate: { gte: dateStart, lte: dateEnd },
      slotStartTime: slotStartTime,
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
   * Validate slot capacity. Accepts either a slotStartTime directly or a raw time
   * (which will be resolved to a slot via findSlotForTime).
   */
  async validateSlotCapacity(
    date: Date,
    slotStartTime: string,
    pointsNeeded: number,
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

    const dayOfWeek = date.getDay();
    const dayName = DAY_NAMES_ES[dayOfWeek];

    if (!slot) {
      return {
        valid: false,
        error: `No hay slot disponible para las ${slotStartTime} del ${dayName}`,
        pointsUsed: 0,
        maxPoints: 0,
        pointsAvailable: 0,
        slotStartTime,
      };
    }

    const pointsUsed = await this.getSlotUsage(date, slot.startTime, excludeId, tx);
    const pointsAvailable = slot.maxPoints - pointsUsed;

    if (pointsAvailable < pointsNeeded) {
      return {
        valid: false,
        error: `Slot ${slot.startTime}-${slot.endTime} lleno: ${pointsUsed}/${slot.maxPoints} puntos usados, necesitas ${pointsNeeded}`,
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

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (current <= end) {
      const slots = await this.getSlotsForDate(current);
      const availableSlots: SlotUsageInfo[] = [];

      for (const slot of slots) {
        const pointsUsed = await this.getSlotUsage(current, slot.startTime);
        const pointsAvailable = slot.maxPoints - pointsUsed;

        if (pointsAvailable >= pointsNeeded) {
          availableSlots.push({
            ...slot,
            pointsUsed,
            pointsAvailable,
          });
        }
      }

      if (availableSlots.length > 0) {
        results.push({
          date: current.toISOString().split("T")[0],
          slots: availableSlots,
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return results;
  }
}

export const slotCapacityValidator = new SlotCapacityValidator();
