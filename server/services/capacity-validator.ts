import { PrismaClient } from "@prisma/client";
import { CapacityConflictError } from "../../shared/types";
import { toMadrid } from "../utils/timezone";

const prisma = new PrismaClient();

const DEFAULT_WORKERS = parseInt(process.env.DEFAULT_WORKERS || "3");
const DEFAULT_FORKLIFTS = parseInt(process.env.DEFAULT_FORKLIFTS || "2");
const DEFAULT_DOCKS = parseInt(process.env.DEFAULT_DOCKS || "3");

interface AppointmentToValidate {
  id?: string; // Exclude this ID when checking conflicts (for updates)
  startUtc: Date;
  endUtc: Date;
  workMinutesNeeded: number;
  forkliftsNeeded: number;
}

interface MinuteCapacity {
  workers: number;
  forklifts: number;
  docks: number;
}

export class CapacityValidator {
  /**
   * Find the capacity shift that applies to a specific minute
   * If multiple shifts overlap, use the most specific one (shortest duration)
   */
  private async getShiftForMinute(minute: Date, shifts: any[]): Promise<MinuteCapacity> {
    const applicableShifts = shifts.filter(
      shift => shift.startUtc <= minute && shift.endUtc > minute
    );

    if (applicableShifts.length === 0) {
      return {
        workers: DEFAULT_WORKERS,
        forklifts: DEFAULT_FORKLIFTS,
        docks: DEFAULT_DOCKS,
      };
    }

    // Use the shift with shortest duration (most specific)
    const mostSpecific = applicableShifts.reduce((shortest, current) => {
      const currentDuration = current.endUtc.getTime() - current.startUtc.getTime();
      const shortestDuration = shortest.endUtc.getTime() - shortest.startUtc.getTime();
      return currentDuration < shortestDuration ? current : shortest;
    });

    return {
      workers: mostSpecific.workers,
      forklifts: mostSpecific.forklifts,
      docks: mostSpecific.docks ?? DEFAULT_DOCKS,
    };
  }

  /**
   * Validate an appointment against capacity constraints
   * Returns null if valid, or CapacityConflictError if there's a conflict
   */
  async validateAppointment(
    appointment: AppointmentToValidate
  ): Promise<CapacityConflictError | null> {
    const { startUtc, endUtc, workMinutesNeeded, forkliftsNeeded, id } = appointment;

    // Calculate duration in minutes
    const durationMs = endUtc.getTime() - startUtc.getTime();
    const durationMinutes = Math.ceil(durationMs / (60 * 1000));

    // Calculate work rate (min/min)
    const workRate = workMinutesNeeded / durationMinutes;

    // Fetch all capacity shifts that might overlap with this appointment
    const shifts = await prisma.capacityShift.findMany({
      where: {
        AND: [
          { startUtc: { lte: endUtc } },
          { endUtc: { gte: startUtc } },
        ],
      },
      orderBy: { startUtc: "asc" },
    });

    // Fetch all appointments that overlap with this time range (excluding the current one if updating)
    const whereClause: any = {
      AND: [
        { startUtc: { lt: endUtc } },
        { endUtc: { gt: startUtc } },
      ],
    };

    if (id) {
      whereClause.NOT = { id };
    }

    const overlappingAppointments = await prisma.appointment.findMany({
      where: whereClause,
    });

    // Check each minute
    for (let i = 0; i < durationMinutes; i++) {
      const minute = new Date(startUtc.getTime() + i * 60 * 1000);
      
      // Get capacity for this minute
      const capacity = await this.getShiftForMinute(minute, shifts);

      // Calculate usage at this minute
      let workUsed = workRate; // This appointment's contribution
      let forkliftsUsed = forkliftsNeeded;
      let docksUsed = 1; // This appointment counts as 1

      for (const other of overlappingAppointments) {
        if (other.startUtc <= minute && other.endUtc > minute) {
          // This appointment overlaps with our minute
          const otherDurationMs = other.endUtc.getTime() - other.startUtc.getTime();
          const otherDurationMinutes = Math.ceil(otherDurationMs / (60 * 1000));
          const otherWorkRate = other.workMinutesNeeded / otherDurationMinutes;

          workUsed += otherWorkRate;
          forkliftsUsed += other.forkliftsNeeded;
          docksUsed += 1;
        }
      }

      // Check constraints
      if (workUsed > capacity.workers) {
        return {
          minute: minute.toISOString(),
          minuteMadrid: toMadrid(minute),
          workUsed: parseFloat(workUsed.toFixed(2)),
          workAvailable: capacity.workers,
          forkliftsUsed,
          forkliftsAvailable: capacity.forklifts,
          docksUsed,
          docksAvailable: capacity.docks,
          failedRule: "work",
        };
      }

      if (forkliftsUsed > capacity.forklifts) {
        return {
          minute: minute.toISOString(),
          minuteMadrid: toMadrid(minute),
          workUsed: parseFloat(workUsed.toFixed(2)),
          workAvailable: capacity.workers,
          forkliftsUsed,
          forkliftsAvailable: capacity.forklifts,
          docksUsed,
          docksAvailable: capacity.docks,
          failedRule: "forklifts",
        };
      }

      if (docksUsed > capacity.docks) {
        return {
          minute: minute.toISOString(),
          minuteMadrid: toMadrid(minute),
          workUsed: parseFloat(workUsed.toFixed(2)),
          workAvailable: capacity.workers,
          forkliftsUsed,
          forkliftsAvailable: capacity.forklifts,
          docksUsed,
          docksAvailable: capacity.docks,
          failedRule: "docks",
        };
      }
    }

    return null; // No conflicts
  }

  /**
   * Calculate current capacity usage for a specific minute
   * Used for real-time capacity indicators in the UI
   */
  async getCapacityAtMinute(minute: Date): Promise<{
    workUsed: number;
    workAvailable: number;
    forkliftsUsed: number;
    forkliftsAvailable: number;
    docksUsed: number;
    docksAvailable: number;
  }> {
    // Get capacity shift for this minute
    const shifts = await prisma.capacityShift.findMany({
      where: {
        AND: [
          { startUtc: { lte: minute } },
          { endUtc: { gt: minute } },
        ],
      },
    });

    const capacity = await this.getShiftForMinute(minute, shifts);

    // Get all appointments active at this minute
    const activeAppointments = await prisma.appointment.findMany({
      where: {
        AND: [
          { startUtc: { lte: minute } },
          { endUtc: { gt: minute } },
        ],
      },
    });

    let workUsed = 0;
    let forkliftsUsed = 0;
    let docksUsed = activeAppointments.length;

    for (const appt of activeAppointments) {
      const durationMs = appt.endUtc.getTime() - appt.startUtc.getTime();
      const durationMinutes = Math.ceil(durationMs / (60 * 1000));
      const workRate = appt.workMinutesNeeded / durationMinutes;
      
      workUsed += workRate;
      forkliftsUsed += appt.forkliftsNeeded;
    }

    return {
      workUsed: parseFloat(workUsed.toFixed(2)),
      workAvailable: capacity.workers,
      forkliftsUsed,
      forkliftsAvailable: capacity.forklifts,
      docksUsed,
      docksAvailable: capacity.docks,
    };
  }
}

export const capacityValidator = new CapacityValidator();
