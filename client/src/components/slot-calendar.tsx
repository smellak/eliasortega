import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { slotsApi, type WeekDay, type WeekSlot, type WeekSlotAppointment } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Plus, Clock, Check, X } from "lucide-react";
import { format, addDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, getDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

const MADRID_TZ = "Europe/Madrid";

/** Format a Date to YYYY-MM-DD in Madrid timezone (matches backend getMadridDateStr) */
function toMadridDateStr(date: Date): string {
  return formatInTimeZone(date, MADRID_TZ, "yyyy-MM-dd");
}

export type CalendarViewType = "week" | "day" | "month";

interface SlotCalendarProps {
  onSlotClick?: (date: string, startTime: string, endTime: string) => void;
  onAppointmentClick?: (appointment: WeekSlotAppointment) => void;
  readOnly?: boolean;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
}

function getOccupationColor(used: number, max: number): string {
  if (max === 0) return "bg-muted";
  const pct = (used / max) * 100;
  if (pct >= 100) return "bg-gray-700 dark:bg-gray-600";
  if (pct >= 80) return "bg-red-100 dark:bg-red-950/60";
  if (pct >= 50) return "bg-yellow-50 dark:bg-yellow-950/40";
  return "bg-green-50 dark:bg-green-950/30";
}

function getOccupationBorderColor(used: number, max: number): string {
  if (max === 0) return "border-muted";
  const pct = (used / max) * 100;
  if (pct >= 100) return "border-gray-500";
  if (pct >= 80) return "border-red-300 dark:border-red-700";
  if (pct >= 50) return "border-yellow-300 dark:border-yellow-700";
  return "border-green-300 dark:border-green-700";
}

function getProgressColor(used: number, max: number): string {
  if (max === 0) return "bg-muted";
  const pct = (used / max) * 100;
  if (pct >= 100) return "bg-gray-500";
  if (pct >= 80) return "bg-red-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

function getSizeBadgeColor(size: string | null): string {
  switch (size) {
    case "S": return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "M": return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "L": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getSizePoints(size: string | null): number {
  switch (size) {
    case "S": return 1;
    case "M": return 2;
    case "L": return 3;
    default: return 0;
  }
}

function PointsBar({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[40px]">
        <div
          className={`h-full rounded-full transition-all ${getProgressColor(used, max)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono whitespace-nowrap">{used}/{max}</span>
    </div>
  );
}

function AppointmentCard({
  appt,
  compact = false,
  onClick,
}: {
  appt: WeekSlotAppointment;
  compact?: boolean;
  onClick?: () => void;
}) {
  const pts = getSizePoints(appt.size);

  const isCancelled = appt.confirmationStatus === "cancelled";
  const isConfirmed = appt.confirmationStatus === "confirmed";

  if (compact) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
        className={`w-full text-left p-1 rounded text-[10px] leading-tight hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isCancelled ? "opacity-50 line-through" : ""}`}
      >
        <div className="font-semibold truncate flex items-center gap-0.5">
          {isConfirmed && <Check className="h-2.5 w-2.5 text-green-600 shrink-0" />}
          {isCancelled && <X className="h-2.5 w-2.5 text-red-500 shrink-0" />}
          {appt.providerName}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground flex-wrap">
          {appt.goodsType && <span className="truncate max-w-[60px]">{appt.goodsType}</span>}
          {appt.units != null && <span>{appt.units} uds</span>}
          {appt.lines != null && <span>· {appt.lines} lín</span>}
          {appt.deliveryNotesCount != null && appt.deliveryNotesCount > 0 && (
            <span>· {appt.deliveryNotesCount} alb</span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {appt.size && (
            <span className={`inline-flex items-center px-1 rounded text-[9px] font-medium ${getSizeBadgeColor(appt.size)}`}>
              {appt.size} · {pts}pts
            </span>
          )}
          {appt.dockCode && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono">
              {appt.dockCode}
            </span>
          )}
          <span className="text-muted-foreground">~{appt.workMinutesNeeded} min</span>
        </div>
      </button>
    );
  }

  // Full card for daily view
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`w-full text-left p-3 rounded-lg border bg-card hover:shadow-md transition-all ${isCancelled ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm flex items-center gap-1.5">
          {isConfirmed && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
          {isCancelled && <X className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          <span className={isCancelled ? "line-through" : ""}>{appt.providerName}</span>
        </div>
        {appt.size && (
          <Badge variant="outline" className={`text-[10px] ${getSizeBadgeColor(appt.size)}`}>
            {appt.size} · {pts} pts
          </Badge>
        )}
        {appt.dockCode && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono">
            {appt.dockCode}
          </span>
        )}
      </div>
      {appt.goodsType && (
        <div className="text-xs text-muted-foreground mt-1">{appt.goodsType}</div>
      )}
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
        {appt.units != null && <span>{appt.units} uds</span>}
        {appt.lines != null && <span>{appt.lines} líneas</span>}
        {appt.deliveryNotesCount != null && appt.deliveryNotesCount > 0 && (
          <span>{appt.deliveryNotesCount} albaranes</span>
        )}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatInTimeZone(new Date(appt.startUtc), MADRID_TZ, "HH:mm")} - {formatInTimeZone(new Date(appt.endUtc), MADRID_TZ, "HH:mm")}
        </span>
        <span>~{appt.workMinutesNeeded} min</span>
      </div>
    </button>
  );
}

// ──────────── WEEK VIEW ────────────

function WeekView({
  weekData,
  isLoading,
  onSlotClick,
  onAppointmentClick,
  readOnly,
}: {
  weekData: WeekDay[];
  isLoading: boolean;
  onSlotClick?: (date: string, startTime: string, endTime: string) => void;
  onAppointmentClick?: (appointment: WeekSlotAppointment) => void;
  readOnly?: boolean;
}) {
  // Gather unique time slots across all days
  const allTimeSlots = useMemo(() => {
    const keys = new Set<string>();
    for (const day of weekData) {
      for (const slot of day.slots) {
        keys.add(`${slot.startTime}-${slot.endTime}`);
      }
    }
    return Array.from(keys).sort();
  }, [weekData]);

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded skeleton-shimmer" />
          ))}
        </div>
      </Card>
    );
  }

  if (weekData.length === 0 || allTimeSlots.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay franjas configuradas para esta semana.
      </Card>
    );
  }

  const today = toMadridDateStr(new Date());

  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse" data-testid="slot-calendar-week">
        <thead>
          <tr>
            <th className="p-2 text-left text-xs font-semibold text-muted-foreground border-b min-w-[80px]">
              Franja
            </th>
            {weekData.map((day) => (
              <th
                key={day.date}
                className={`p-2 text-center text-xs font-semibold border-b min-w-[140px] ${
                  day.date === today ? "bg-primary/5" : ""
                }`}
              >
                <div className={day.date === today ? "text-primary" : "text-muted-foreground"}>
                  {day.dayName}
                </div>
                <div className={`text-sm ${day.date === today ? "text-primary font-bold" : ""}`}>
                  {format(new Date(day.date + "T12:00:00"), "dd/MM", { locale: es })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allTimeSlots.map((timeKey) => {
            const [startTime, endTime] = timeKey.split("-");
            return (
              <tr key={timeKey}>
                <td className="p-2 text-xs font-mono font-medium whitespace-nowrap border-r align-top">
                  {startTime}
                  <br />
                  <span className="text-muted-foreground">{endTime}</span>
                </td>
                {weekData.map((day) => {
                  const slot = day.slots.find(
                    (s) => s.startTime === startTime && s.endTime === endTime
                  );
                  if (!slot) {
                    return <td key={day.date} className="p-1 border-r" />;
                  }
                  const isFull = slot.availablePoints <= 0;
                  const canClick = !readOnly && !isFull;

                  return (
                    <td
                      key={day.date}
                      className={`p-1 border-r align-top cursor-pointer transition-colors ${getOccupationColor(slot.usedPoints, slot.maxPoints)} ${
                        day.date === today ? "ring-1 ring-inset ring-primary/20" : ""
                      }`}
                      onClick={() => canClick && onSlotClick?.(day.date, slot.startTime, slot.endTime)}
                    >
                      <div className="min-h-[60px]">
                        <div className="flex items-center gap-1">
                          <div className="flex-1">
                            <PointsBar used={slot.usedPoints} max={slot.maxPoints} />
                          </div>
                          {slot.activeDocks !== undefined && slot.activeDocks > 0 && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              {slot.activeDocks}M
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5">
                          {slot.appointments.map((appt) => (
                            <AppointmentCard
                              key={appt.id}
                              appt={appt}
                              compact
                              onClick={() => onAppointmentClick?.(appt)}
                            />
                          ))}
                        </div>
                        {slot.appointments.length === 0 && (
                          <div className="text-[10px] text-muted-foreground text-center mt-2">
                            {canClick ? "Clic para añadir" : ""}
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ──────────── DAY VIEW ────────────

function DayView({
  weekData,
  currentDate,
  onSlotClick,
  onAppointmentClick,
  readOnly,
  isLoading,
}: {
  weekData: WeekDay[];
  currentDate: Date;
  onSlotClick?: (date: string, startTime: string, endTime: string) => void;
  onAppointmentClick?: (appointment: WeekSlotAppointment) => void;
  readOnly?: boolean;
  isLoading: boolean;
}) {
  const dateStr = toMadridDateStr(currentDate);
  const dayData = weekData.find((d) => d.date === dateStr);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <div className="h-24 rounded skeleton-shimmer" />
          </Card>
        ))}
      </div>
    );
  }

  if (!dayData || dayData.slots.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay franjas configuradas para {format(currentDate, "EEEE dd/MM/yyyy", { locale: es })}.
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="slot-calendar-day">
      {dayData.slots.map((slot) => {
        const isFull = slot.availablePoints <= 0;

        return (
          <Card
            key={`${slot.startTime}-${slot.endTime}`}
            className={`p-4 border ${getOccupationBorderColor(slot.usedPoints, slot.maxPoints)}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-lg font-mono font-semibold">
                  {slot.startTime} - {slot.endTime}
                </span>
                <Badge variant="outline" className="text-xs">
                  {slot.usedPoints}/{slot.maxPoints} puntos
                </Badge>
                {slot.activeDocks !== undefined && slot.activeDocks > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    {slot.activeDocks}M
                  </span>
                )}
              </div>
              {!readOnly && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isFull}
                        onClick={() => onSlotClick?.(dateStr, slot.startTime, slot.endTime)}
                        data-testid={`button-add-appt-${slot.startTime}`}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Añadir
                      </Button>
                    </TooltipTrigger>
                    {isFull && (
                      <TooltipContent>Franja completa</TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="mb-3">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getProgressColor(slot.usedPoints, slot.maxPoints)}`}
                  style={{ width: `${slot.maxPoints > 0 ? Math.min((slot.usedPoints / slot.maxPoints) * 100, 100) : 0}%` }}
                />
              </div>
            </div>

            {slot.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sin citas en esta franja
              </p>
            ) : (
              <div className="space-y-2">
                {slot.appointments.map((appt) => (
                  <AppointmentCard
                    key={appt.id}
                    appt={appt}
                    onClick={() => onAppointmentClick?.(appt)}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ──────────── MONTH VIEW ────────────

function MonthView({
  weekData,
  currentDate,
  onDayClick,
  isLoading,
}: {
  weekData: WeekDay[];
  currentDate: Date;
  onDayClick: (date: Date) => void;
  isLoading: boolean;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Build a lookup from weekData
  const dayLookup = useMemo(() => {
    const map = new Map<string, { appointments: number; usedPoints: number; maxPoints: number }>();
    for (const day of weekData) {
      let totalUsed = 0;
      let totalMax = 0;
      let totalAppts = 0;
      for (const slot of day.slots) {
        totalUsed += slot.usedPoints;
        totalMax += slot.maxPoints;
        totalAppts += slot.appointments.length;
      }
      map.set(day.date, { appointments: totalAppts, usedPoints: totalUsed, maxPoints: totalMax });
    }
    return map;
  }, [weekData]);

  // Build calendar grid
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    // Start from Monday of the week containing monthStart
    const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    let current = new Date(weekStart);

    while (current <= monthEnd || weeks.length < 5) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current = addDays(current, 1);
      }
      weeks.push(week);
      if (current > monthEnd && weeks.length >= 4) break;
    }
    return weeks;
  }, [monthStart, monthEnd]);

  const today = toMadridDateStr(new Date());
  const dayHeaders = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <Card className="overflow-hidden" data-testid="slot-calendar-month">
      <div className="grid grid-cols-7">
        {dayHeaders.map((dh) => (
          <div key={dh} className="p-2 text-center text-xs font-semibold text-muted-foreground border-b bg-muted/30">
            {dh}
          </div>
        ))}
        {calendarWeeks.map((week, wi) =>
          week.map((day, di) => {
            const dateStr = toMadridDateStr(day);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = dateStr === today;
            const info = dayLookup.get(dateStr);
            const pct = info && info.maxPoints > 0 ? (info.usedPoints / info.maxPoints) * 100 : 0;

            let bgColor = "";
            if (info && info.maxPoints > 0) {
              if (pct >= 80) bgColor = "bg-red-50 dark:bg-red-950/30";
              else if (pct >= 50) bgColor = "bg-yellow-50 dark:bg-yellow-950/20";
              else if (pct > 0) bgColor = "bg-green-50 dark:bg-green-950/20";
            }

            return (
              <button
                key={dateStr}
                className={`p-2 border-b border-r text-left min-h-[70px] transition-colors hover:bg-muted/50 ${
                  isCurrentMonth ? "" : "opacity-40"
                } ${isToday ? "ring-2 ring-inset ring-primary/30" : ""} ${bgColor}`}
                onClick={() => onDayClick(day)}
              >
                <div className={`text-sm font-medium ${isToday ? "text-primary font-bold" : ""}`}>
                  {day.getDate()}
                </div>
                {info && isCurrentMonth && (
                  <div className="mt-1 text-[10px] text-muted-foreground leading-tight">
                    <div>{info.appointments} citas</div>
                    <div>{info.usedPoints}/{info.maxPoints} pts</div>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}

// ──────────── MAIN COMPONENT ────────────

export function SlotCalendar({
  onSlotClick,
  onAppointmentClick,
  readOnly = false,
  currentDate,
  onDateChange,
  currentView,
  onViewChange,
}: SlotCalendarProps) {
  // Determine the date to query for the week endpoint (Madrid timezone)
  const queryDate = useMemo(() => {
    return toMadridDateStr(currentDate);
  }, [currentDate]);

  // For month view, we fetch usage data instead
  const { data: weekData = [], isLoading: weekLoading } = useQuery<WeekDay[]>({
    queryKey: ["/api/slots/week", queryDate],
    queryFn: () => slotsApi.getWeek(queryDate),
    enabled: currentView !== "month",
  });

  // For month view, fetch multiple weeks to cover the full month
  const monthWeekDates = useMemo(() => {
    if (currentView !== "month") return [];
    const mStart = startOfMonth(currentDate);
    const mEnd = endOfMonth(currentDate);
    const dates: string[] = [];
    // Get Monday of each week in the month
    const startDay = startOfWeek(mStart, { weekStartsOn: 1 });
    let cursor = new Date(startDay);
    while (cursor <= mEnd) {
      dates.push(toMadridDateStr(cursor));
      cursor = addDays(cursor, 7);
    }
    return dates;
  }, [currentDate, currentView]);

  const monthQueries = useQuery<WeekDay[]>({
    queryKey: ["/api/slots/week-month", ...monthWeekDates],
    queryFn: async () => {
      const results: WeekDay[] = [];
      const seen = new Set<string>();
      for (const d of monthWeekDates) {
        const weekResult = await slotsApi.getWeek(d);
        for (const day of weekResult) {
          if (!seen.has(day.date)) {
            seen.add(day.date);
            results.push(day);
          }
        }
      }
      return results;
    },
    enabled: currentView === "month" && monthWeekDates.length > 0,
  });

  const activeData = currentView === "month" ? (monthQueries.data || []) : weekData;
  const isLoading = currentView === "month" ? monthQueries.isLoading : weekLoading;

  const handlePrev = () => {
    if (currentView === "week") onDateChange(subWeeks(currentDate, 1));
    else if (currentView === "day") onDateChange(addDays(currentDate, -1));
    else onDateChange(subMonths(currentDate, 1));
  };

  const handleNext = () => {
    if (currentView === "week") onDateChange(addWeeks(currentDate, 1));
    else if (currentView === "day") onDateChange(addDays(currentDate, 1));
    else onDateChange(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleMonthDayClick = (date: Date) => {
    onDateChange(date);
    onViewChange("day");
  };

  const titleText = useMemo(() => {
    if (currentView === "day") {
      return format(currentDate, "EEEE dd 'de' MMMM yyyy", { locale: es });
    }
    if (currentView === "month") {
      return format(currentDate, "MMMM yyyy", { locale: es });
    }
    // Week: show range
    if (weekData.length >= 2) {
      const first = weekData[0].date;
      const last = weekData[weekData.length - 1].date;
      return `${format(new Date(first + "T12:00:00"), "dd MMM", { locale: es })} — ${format(new Date(last + "T12:00:00"), "dd MMM yyyy", { locale: es })}`;
    }
    return format(currentDate, "MMMM yyyy", { locale: es });
  }, [currentView, currentDate, weekData]);

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrev} data-testid="button-calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-calendar-today">
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} data-testid="button-calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold ml-2 capitalize">{titleText}</h2>
        </div>

        <div className="flex gap-0.5 rounded-full bg-muted p-1">
          <Button
            variant={currentView === "month" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onViewChange("month")}
            data-testid="button-view-month"
          >
            Mes
          </Button>
          <Button
            variant={currentView === "week" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onViewChange("week")}
            data-testid="button-view-week"
          >
            Semana
          </Button>
          <Button
            variant={currentView === "day" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onViewChange("day")}
            data-testid="button-view-day"
          >
            Día
          </Button>
        </div>
      </div>

      {/* View Content */}
      {currentView === "week" && (
        <WeekView
          weekData={weekData}
          isLoading={isLoading}
          onSlotClick={onSlotClick}
          onAppointmentClick={onAppointmentClick}
          readOnly={readOnly}
        />
      )}
      {currentView === "day" && (
        <DayView
          weekData={activeData}
          currentDate={currentDate}
          onSlotClick={onSlotClick}
          onAppointmentClick={onAppointmentClick}
          readOnly={readOnly}
          isLoading={isLoading}
        />
      )}
      {currentView === "month" && (
        <MonthView
          weekData={activeData}
          currentDate={currentDate}
          onDayClick={handleMonthDayClick}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
