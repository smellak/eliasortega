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

/**
 * Get default capacity values for a specific day of the week
 * @param dayOfWeek - JavaScript day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns Capacity configuration for that day
 */
function getDefaultCapacityForDay(dayOfWeek: number): {
  workers: number;
  forklifts: number;
  docks: number;
  startHour: number | null;
  endHour: number | null;
  minutesPerDay: number;
} {
  switch (dayOfWeek) {
    case 0: // Domingo - CERRADO
      return {
        workers: 0,
        forklifts: 0,
        docks: 0,
        startHour: null,
        endHour: null,
        minutesPerDay: 0,
      };
    
    case 6: // Sábado - CAPACIDAD REDUCIDA
      return {
        workers: 2,
        forklifts: 1,
        docks: 2,
        startHour: 8,
        endHour: 14, // Solo mañana (6 horas)
        minutesPerDay: 360,
      };
    
    default: // Lunes-Viernes - CAPACIDAD NORMAL
      return {
        workers: DEFAULT_WORKERS,
        forklifts: DEFAULT_FORKLIFTS,
        docks: DEFAULT_DOCKS,
        startHour: DEFAULT_START_HOUR,
        endHour: DEFAULT_END_HOUR,
        minutesPerDay: DEFAULT_MINUTES_PER_DAY,
      };
  }
}

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
      // Use day-specific default capacity
      const dayOfWeek = minute.getDay();
      const defaultCapacity = getDefaultCapacityForDay(dayOfWeek);
      return {
        workers: defaultCapacity.workers,
        forklifts: defaultCapacity.forklifts,
        docks: defaultCapacity.docks,
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
    defaultDaysBreakdown: {
      sundays: number;
      saturdays: number;
      weekdays: number;
    };
    breakdown: {
      workers: { used: number; available: number };
      forklifts: { used: number; available: number };
      docks: { used: number; available: number };
    };
  }> {
    // Fetch all appointments that overlap with the range (not just contained within)
    const appointments = await prisma.appointment.findMany({
      where: {
        AND: [
          { startUtc: { lt: endDate } },  // Appointment starts before range ends
          { endUtc: { gt: startDate } },  // Appointment ends after range starts
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
    
    // Track default days by type
    let defaultSundays = 0;
    let defaultSaturdays = 0;
    let defaultWeekdays = 0;

    // Track peak day
    let peakDay: string | null = null;
    let peakPercentage = 0;

    // Process each day in range
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0); // Start at beginning of day
    const dailyUtilizations: Array<{ date: string; percentage: number }> = [];
    
    const endDateMidnight = new Date(endDate);
    endDateMidnight.setHours(0, 0, 0, 0);

    while (currentDate <= endDateMidnight) {
      const dayOfWeek = currentDate.getDay();
      const defaultCapacity = getDefaultCapacityForDay(dayOfWeek);
      
      // Always set dayStart to beginning of current day
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      
      // Always set dayEnd to end of current day
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      // Get shifts for this day
      const dayShifts = shifts.filter(
        shift => shift.startUtc < dayEnd && shift.endUtc > dayStart
      );

      if (dayShifts.length === 0) {
        // No shifts programmed - use day-specific defaults
        totalWorkersMinutes += defaultCapacity.workers * defaultCapacity.minutesPerDay;
        totalForkliftsMinutes += defaultCapacity.forklifts * defaultCapacity.minutesPerDay;
        totalDocksMinutes += defaultCapacity.docks * defaultCapacity.minutesPerDay;
        daysUsingDefaults++;
        
        // Track by day type
        if (dayOfWeek === 0) {
          defaultSundays++;
        } else if (dayOfWeek === 6) {
          defaultSaturdays++;
        } else {
          defaultWeekdays++;
        }
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
      // Use overlapping logic: appointment overlaps if it starts before day ends AND ends after day starts
      const dayAppointments = appointments.filter(
        appt => appt.startUtc < dayEnd && appt.endUtc > dayStart
      );

      if (dayAppointments.length > 0) {
        // Calculate resource usage considering only the overlap with this day
        let dayWorkUsed = 0;
        let dayForkliftsUsed = 0;
        let dayDocksUsed = 0;
        
        for (const appt of dayAppointments) {
          // Calculate the overlap between appointment and this day
          const overlapStart = appt.startUtc > dayStart ? appt.startUtc : dayStart;
          const overlapEnd = appt.endUtc < dayEnd ? appt.endUtc : dayEnd;
          const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
          const overlapMinutes = Math.ceil(overlapMs / 60000);
          
          // Calculate what fraction of the appointment falls within this day
          const totalApptMs = appt.endUtc.getTime() - appt.startUtc.getTime();
          const totalApptMinutes = Math.ceil(totalApptMs / 60000);
          const fractionInDay = overlapMinutes / totalApptMinutes;
          
          // Workers: proportion of workMinutesNeeded that falls in this day
          dayWorkUsed += appt.workMinutesNeeded * fractionInDay;
          
          // Forklifts: forklifts needed × overlap duration
          dayForkliftsUsed += appt.forkliftsNeeded * overlapMinutes;
          
          // Docks: overlap duration (1 dock per appointment)
          dayDocksUsed += overlapMinutes;
        }

        const dayWorkersCapacity = dayShifts.length > 0 
          ? dayShifts.reduce((sum, s) => {
              const sStart = s.startUtc > dayStart ? s.startUtc : dayStart;
              const sEnd = s.endUtc < dayEnd ? s.endUtc : dayEnd;
              const mins = Math.ceil((sEnd.getTime() - sStart.getTime()) / 60000);
              return sum + (s.workers * mins);
            }, 0)
          : defaultCapacity.workers * defaultCapacity.minutesPerDay;

        const dayForkliftsCapacity = dayShifts.length > 0
          ? dayShifts.reduce((sum, s) => {
              const sStart = s.startUtc > dayStart ? s.startUtc : dayStart;
              const sEnd = s.endUtc < dayEnd ? s.endUtc : dayEnd;
              const mins = Math.ceil((sEnd.getTime() - sStart.getTime()) / 60000);
              return sum + (s.forklifts * mins);
            }, 0)
          : defaultCapacity.forklifts * defaultCapacity.minutesPerDay;

        const dayDocksCapacity = dayShifts.length > 0
          ? dayShifts.reduce((sum, s) => {
              const sStart = s.startUtc > dayStart ? s.startUtc : dayStart;
              const sEnd = s.endUtc < dayEnd ? s.endUtc : dayEnd;
              const mins = Math.ceil((sEnd.getTime() - sStart.getTime()) / 60000);
              return sum + ((s.docks ?? defaultCapacity.docks) * mins);
            }, 0)
          : defaultCapacity.docks * defaultCapacity.minutesPerDay;

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

    // Calculate total resource usage (in resource-minutes)
    // Only count the portion of each appointment that falls within the requested range
    let totalWorkUsed = 0;
    let totalForkliftsUsed = 0;
    let totalDocksUsed = 0;

    for (const appt of appointments) {
      // Calculate overlap between appointment and requested range
      const overlapStart = appt.startUtc > startDate ? appt.startUtc : startDate;
      const overlapEnd = appt.endUtc < endDate ? appt.endUtc : endDate;
      const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
      const overlapMinutes = Math.ceil(overlapMs / 60000);
      
      // Calculate fraction of appointment within range
      const totalApptMs = appt.endUtc.getTime() - appt.startUtc.getTime();
      const totalApptMinutes = Math.ceil(totalApptMs / 60000);
      const fractionInRange = overlapMinutes / totalApptMinutes;
      
      // Workers: proportion of workMinutesNeeded within range
      totalWorkUsed += appt.workMinutesNeeded * fractionInRange;
      
      // Forklifts: forklifts × overlap duration
      totalForkliftsUsed += appt.forkliftsNeeded * overlapMinutes;
      
      // Docks: overlap duration
      totalDocksUsed += overlapMinutes;
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
      defaultDaysBreakdown: {
        sundays: defaultSundays,
        saturdays: defaultSaturdays,
        weekdays: defaultWeekdays,
      },
      breakdown: {
        workers: { used: totalWorkUsed, available: totalWorkersMinutes },
        forklifts: { used: totalForkliftsUsed, available: totalForkliftsMinutes },
        docks: { used: totalDocksUsed, available: totalDocksMinutes },
      },
    };
  }
}

export const capacityValidator = new CapacityValidator();
