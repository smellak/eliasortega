import { prisma } from "../db/client";

type PrismaTransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface SlotInfo {
  startTime: string;
  endTime: string;
  maxPoints: number;
  isOverride: boolean;
  reason?: string | null;
}

interface SlotUsageInfo extends SlotInfo {
  pointsUsed: number;
  pointsAvailable: number;
}

interface CacheEntry {
  data: any;
  expiresAt: number;
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

  async getSlotUsage(
    date: Date,
    slotStartTime: string,
    excludeId?: string,
    tx?: PrismaTransactionClient
  ): Promise<number> {
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
      select: { pointsUsed: true },
    });

    return appointments.reduce((sum, a) => sum + (a.pointsUsed || 0), 0);
  }

  async validateSlotCapacity(
    date: Date,
    slotStartTime: string,
    pointsNeeded: number,
    excludeId?: string,
    tx?: PrismaTransactionClient
  ): Promise<{ valid: boolean; pointsUsed: number; maxPoints: number; pointsAvailable: number }> {
    const slots = await this.getSlotsForDate(date, tx);
    const slot = slots.find((s) => s.startTime === slotStartTime);

    if (!slot) {
      return { valid: false, pointsUsed: 0, maxPoints: 0, pointsAvailable: 0 };
    }

    const pointsUsed = await this.getSlotUsage(date, slotStartTime, excludeId, tx);
    const pointsAvailable = slot.maxPoints - pointsUsed;

    return {
      valid: pointsAvailable >= pointsNeeded,
      pointsUsed,
      maxPoints: slot.maxPoints,
      pointsAvailable,
    };
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
