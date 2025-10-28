import { toZonedTime, formatInTimeZone } from "date-fns-tz";

const MADRID_TZ = "Europe/Madrid";

export function toUTC(dateString: string): Date {
  return new Date(dateString);
}

export function toMadrid(date: Date): string {
  return formatInTimeZone(date, MADRID_TZ, "yyyy-MM-dd HH:mm");
}

export function parseToUTC(dateString: string, timezone: string = MADRID_TZ): Date {
  // If the input already has timezone info, parse it directly
  if (dateString.includes("Z") || dateString.includes("+") || dateString.includes("-")) {
    return new Date(dateString);
  }
  
  // Otherwise, treat it as Europe/Madrid time and convert to UTC
  const zonedTime = toZonedTime(dateString, timezone);
  return zonedTime;
}
