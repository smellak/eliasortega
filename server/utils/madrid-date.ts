import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TZ = "Europe/Madrid";

/** Get day of week (0-6) in Madrid timezone */
export function getMadridDayOfWeek(date: Date): number {
  const dayStr = formatInTimeZone(date, TZ, "i"); // 1=Mon..7=Sun (ISO)
  const isoDay = parseInt(dayStr, 10);
  return isoDay === 7 ? 0 : isoDay; // Convert to JS: 0=Sun, 1=Mon..6=Sat
}

/** Get midnight in Madrid as UTC Date */
export function getMadridMidnight(date: Date): Date {
  const dateStr = formatInTimeZone(date, TZ, "yyyy-MM-dd");
  return fromZonedTime(`${dateStr}T00:00:00`, TZ);
}

/** Get end of day in Madrid as UTC Date */
export function getMadridEndOfDay(date: Date): Date {
  const dateStr = formatInTimeZone(date, TZ, "yyyy-MM-dd");
  return fromZonedTime(`${dateStr}T23:59:59.999`, TZ);
}

/** Get HH:mm in Madrid timezone */
export function getMadridTime(date: Date): string {
  return formatInTimeZone(date, TZ, "HH:mm");
}

/** Get yyyy-MM-dd in Madrid timezone */
export function getMadridDateStr(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}
