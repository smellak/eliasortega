import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { parse } from "date-fns";

const MADRID_TZ = "Europe/Madrid";

export function toUTC(dateString: string): Date {
  return new Date(dateString);
}

export function toMadrid(date: Date): string {
  return formatInTimeZone(date, MADRID_TZ, "yyyy-MM-dd HH:mm");
}

export function parseToUTC(dateString: string, timezone: string = MADRID_TZ): Date {
  // If the input already has timezone info, parse it directly
  if (dateString.includes("Z") || dateString.includes("+") || dateString.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(dateString);
  }
  
  // Otherwise, treat it as Europe/Madrid time and convert to UTC
  // fromZonedTime interprets the dateString as a wall-clock time in the given timezone
  // and returns the equivalent UTC instant
  // First, parse the date string to create a Date object (which will be interpreted as local)
  // Then use fromZonedTime to get the correct UTC time for that wall-clock time in Madrid
  const parsedDate = new Date(dateString);
  return fromZonedTime(parsedDate, timezone);
}
