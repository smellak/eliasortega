import { PrismaClient } from "@prisma/client";
import { CapacityConflictError } from "../../shared/types";
import { toMadrid } from "../utils/timezone";

const prisma = new PrismaClient();

const DEFAULT_WORKERS = parseInt(process.env.DEFAULT_WORKERS || "3");
const DEFAULT_FORKLIFTS = parseInt(process.env.DEFAULT_FORKLIFTS || "2");
const DEFAULT_DOCKS = parseInt(process.env.DEFAULT_DOCKS || "3");

// Default operating hours: 08:00 - 19:00 (11 hours = 660 minutes)
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 19;
const DEFAULT_MINUTES_PER_DAY = (DEFAULT_END_HOUR - DEFAULT_START_HOUR) * 60;

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

  /**
   * Calculate warehouse capacity utilization for a date range
   * Returns percentage based on most saturated resource (bottleneck)
   */
  async calculateUtilization(startDate: Date, endDate: Date): Promise<{
    appointmentCount: number;
    capacityPercentage: number;
    workersPercentage: number;
    forkliftsPercentage: number;
    docksPercentage: number;
    peakDay: string | null;
    peakPercentage: number;
    daysUsingDefaults: number;
    breakdown: {
      workers: { used: number; available: number };
      forklifts: { used: number; available: number };
      docks: { used: number; available: number };
    };
  }> {
    // Fetch all appointments in range
    const appointments = await prisma.appointment.findMany({
      where: {
        AND: [
          { startUtc: { gte: startDate } },
          { endUtc: { lte: endDate } },
        ],
      },
    });

    // Fetch all capacity shifts in range
    const shifts = await prisma.capacityShift.findMany({
      where: {
        AND: [
          { startUtc: { lt: endDate } },
          { endUtc: { gt: startDate } },
        ],
      },
      orderBy: { startUtc: "asc" },
    });

    // Calculate total capacity available per resource
    let totalWorkersMinutes = 0;
    let totalForkliftsMinutes = 0;
    let totalDocksMinutes = 0;
    let daysUsingDefaults = 0;

    // Track peak day
    let peakDay: string | null = null;
    let peakPercentage = 0;

    // Process each day in range
    const currentDate = new Date(startDate);
    const dailyUtilizations: Array<{ date: string; percentage: number }> = [];

    while (currentDate < endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(DEFAULT_START_HOUR, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(DEFAULT_END_HOUR, 0, 0, 0);

      // Get shifts for this day
      const dayShifts = shifts.filter(
        shift => shift.startUtc < dayEnd && shift.endUtc > dayStart
      );

      if (dayShifts.length === 0) {
        // No shifts programmed - use defaults
        totalWorkersMinutes += DEFAULT_WORKERS * DEFAULT_MINUTES_PER_DAY;
        totalForkliftsMinutes += DEFAULT_FORKLIFTS * DEFAULT_MINUTES_PER_DAY;
        totalDocksMinutes += DEFAULT_DOCKS * DEFAULT_MINUTES_PER_DAY;
        daysUsingDefaults++;
      } else {
        // Sum capacity from all shifts (handling overlaps)
        for (const shift of dayShifts) {
          const shiftStart = shift.startUtc > dayStart ? shift.startUtc : dayStart;
          const shiftEnd = shift.endUtc < dayEnd ? shift.endUtc : dayEnd;
          const shiftMinutes = Math.ceil((shiftEnd.getTime() - shiftStart.getTime()) / 60000);

          totalWorkersMinutes += shift.workers * shiftMinutes;
          totalForkliftsMinutes += shift.forklifts * shiftMinutes;
          totalDocksMinutes += (shift.docks ?? DEFAULT_DOCKS) * shiftMinutes;
        }
      }

      // Calculate day utilization for peak detection
      const dayAppointments = appointments.filter(
        appt => appt.startUtc >= dayStart && appt.endUtc <= dayEnd
      );

      if (dayAppointments.length > 0) {
        const dayWorkUsed = dayAppointments.reduce((sum, appt) => sum + appt.workMinutesNeeded, 0);
        const dayForkliftsUsed = dayAppointments.reduce((sum, appt) => {
          const durationMs = appt.endUtc.getTime() - appt.startUtc.getTime();
          const durationMinutes = Math.ceil(durationMs / 60000);
          return sum + (appt.forkliftsNeeded * durationMinutes);
        }, 0);
        const dayDocksUsed = dayAppointments.reduce((sum, appt) => {
          const durationMs = appt.endUtc.getTime() - appt.startUtc.getTime();
          const durationMinutes = Math.ceil(durationMs / 60000);
          return sum + durationMinutes; // Each appointment uses 1 dock
        }, 0);

        const dayWorkersCapacity = dayShifts.length > 0 
          ? dayShifts.reduce((sum, s) => {
              const sStart = s.startUtc > dayStart ? s.startUtc : dayStart;
              const sEnd = s.endUtc < dayEnd ? s.endUtc : dayEnd;
              const mins = Math.ceil((sEnd.getTime() - sStart.getTime()) / 60000);
              return sum + (s.workers * mins);
            }, 0)
          : DEFAULT_WORKERS * DEFAULT_MINUTES_PER_DAY;

        const dayForkliftsCapacity = dayShifts.length > 0
          ? dayShifts.reduce((sum, s) => {
              const sStart = s.startUtc > dayStart ? s.startUtc : dayStart;
              const sEnd = s.endUtc < dayEnd ? s.endUtc : dayEnd;
              const mins = Math.ceil((sEnd.getTime() - sStart.getTime()) / 60000);
              return sum + (s.forklifts * mins);
            }, 0)
          : DEFAULT_FORKLIFTS * DEFAULT_MINUTES_PER_DAY;

        const dayDocksCapacity = dayShifts.length > 0
          ? dayShifts.reduce((sum, s) => {
              const sStart = s.startUtc > dayStart ? s.startUtc : dayStart;
              const sEnd = s.endUtc < dayEnd ? s.endUtc : dayEnd;
              const mins = Math.ceil((sEnd.getTime() - sStart.getTime()) / 60000);
              return sum + ((s.docks ?? DEFAULT_DOCKS) * mins);
            }, 0)
          : DEFAULT_DOCKS * DEFAULT_MINUTES_PER_DAY;

        const dayWorkersPct = dayWorkersCapacity > 0 ? (dayWorkUsed / dayWorkersCapacity) * 100 : 0;
        const dayForkliftsPct = dayForkliftsCapacity > 0 ? (dayForkliftsUsed / dayForkliftsCapacity) * 100 : 0;
        const dayDocksPct = dayDocksCapacity > 0 ? (dayDocksUsed / dayDocksCapacity) * 100 : 0;
        const dayPct = Math.max(dayWorkersPct, dayForkliftsPct, dayDocksPct);

        if (dayPct > peakPercentage) {
          peakPercentage = dayPct;
          peakDay = currentDate.toISOString().split('T')[0];
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate total resource usage
    let totalWorkUsed = 0;
    let totalForkliftsUsed = 0;
    let totalDocksUsed = 0;

    for (const appt of appointments) {
      totalWorkUsed += appt.workMinutesNeeded;
      
      const durationMs = appt.endUtc.getTime() - appt.startUtc.getTime();
      const durationMinutes = Math.ceil(durationMs / 60000);
      totalForkliftsUsed += appt.forkliftsNeeded * durationMinutes;
      totalDocksUsed += durationMinutes; // Each appointment uses 1 dock
    }

    // Calculate percentages
    const workersPercentage = totalWorkersMinutes > 0
      ? (totalWorkUsed / totalWorkersMinutes) * 100
      : 0;
    const forkliftsPercentage = totalForkliftsMinutes > 0
      ? (totalForkliftsUsed / totalForkliftsMinutes) * 100
      : 0;
    const docksPercentage = totalDocksMinutes > 0
      ? (totalDocksUsed / totalDocksMinutes) * 100
      : 0;

    // Capacity is the maximum (bottleneck)
    const capacityPercentage = Math.max(workersPercentage, forkliftsPercentage, docksPercentage);

    return {
      appointmentCount: appointments.length,
      capacityPercentage: parseFloat(capacityPercentage.toFixed(1)),
      workersPercentage: parseFloat(workersPercentage.toFixed(1)),
      forkliftsPercentage: parseFloat(forkliftsPercentage.toFixed(1)),
      docksPercentage: parseFloat(docksPercentage.toFixed(1)),
      peakDay,
      peakPercentage: parseFloat(peakPercentage.toFixed(1)),
      daysUsingDefaults,
      breakdown: {
        workers: { used: totalWorkUsed, available: totalWorkersMinutes },
        forklifts: { used: totalForkliftsUsed, available: totalForkliftsMinutes },
        docks: { used: totalDocksUsed, available: totalDocksMinutes },
      },
    };
  }
}

export const capacityValidator = new CapacityValidator();
