import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { slotsApi, type WeekDay, type WeekSlot, type WeekSlotAppointment } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Plus, Clock, Check, X } from "lucide-react";
import { format, addDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { es } from "date-fns/locale";

const MADRID_TZ = "Europe/Madrid";

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

// ──────────── MEJORA 6 — CATEGORY COLOR PALETTE ────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "Asientos":    { bg: "bg-violet-50 dark:bg-violet-950/30",   border: "border-l-violet-500",  text: "text-violet-700 dark:text-violet-300",  dot: "bg-violet-500" },
  "Baño":        { bg: "bg-cyan-50 dark:bg-cyan-950/30",       border: "border-l-cyan-500",    text: "text-cyan-700 dark:text-cyan-300",      dot: "bg-cyan-500" },
  "Cocina":      { bg: "bg-amber-50 dark:bg-amber-950/30",     border: "border-l-amber-500",   text: "text-amber-700 dark:text-amber-300",    dot: "bg-amber-500" },
  "Colchonería": { bg: "bg-indigo-50 dark:bg-indigo-950/30",   border: "border-l-indigo-500",  text: "text-indigo-700 dark:text-indigo-300",  dot: "bg-indigo-500" },
  "Electro":     { bg: "bg-yellow-50 dark:bg-yellow-950/30",   border: "border-l-yellow-500",  text: "text-yellow-700 dark:text-yellow-300",  dot: "bg-yellow-500" },
  "Mobiliario":  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-l-emerald-500", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  "PAE":         { bg: "bg-orange-50 dark:bg-orange-950/30",   border: "border-l-orange-500",  text: "text-orange-700 dark:text-orange-300",  dot: "bg-orange-500" },
  "Tapicería":   { bg: "bg-rose-50 dark:bg-rose-950/30",       border: "border-l-rose-500",    text: "text-rose-700 dark:text-rose-300",      dot: "bg-rose-500" },
};

const DEFAULT_CAT_STYLE = {
  bg: "bg-slate-50 dark:bg-slate-900/30",
  border: "border-l-slate-400",
  text: "text-slate-600 dark:text-slate-400",
  dot: "bg-slate-400",
};

export function getCategoryStyle(goodsType: string | null) {
  if (!goodsType) return DEFAULT_CAT_STYLE;
  if (CATEGORY_COLORS[goodsType]) return CATEGORY_COLORS[goodsType];
  const lower = goodsType.toLowerCase();
  for (const [key, style] of Object.entries(CATEGORY_COLORS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return style;
  }
  return DEFAULT_CAT_STYLE;
}

// ──────────── UTILITY FUNCTIONS ────────────

function getOccupationBg(used: number, max: number): string {
  if (max === 0) return "bg-muted/20";
  const pct = (used / max) * 100;
  if (pct >= 100) return "bg-red-50/80 dark:bg-red-950/30";
  if (pct >= 80) return "bg-orange-50/60 dark:bg-orange-950/20";
  if (pct >= 50) return "bg-yellow-50/50 dark:bg-yellow-950/20";
  return "bg-emerald-50/40 dark:bg-emerald-950/15";
}

function getOccupationBorderColor(used: number, max: number): string {
  if (max === 0) return "border-muted";
  const pct = (used / max) * 100;
  if (pct >= 100) return "border-red-300 dark:border-red-700";
  if (pct >= 80) return "border-orange-300 dark:border-orange-700";
  if (pct >= 50) return "border-yellow-300 dark:border-yellow-700";
  return "border-emerald-300 dark:border-emerald-700";
}

function getProgressGradient(used: number, max: number): string {
  if (max === 0) return "bg-muted";
  const pct = (used / max) * 100;
  if (pct >= 100) return "bg-gradient-to-r from-red-400 to-red-600";
  if (pct >= 80) return "bg-gradient-to-r from-orange-400 to-red-500";
  if (pct >= 50) return "bg-gradient-to-r from-yellow-400 to-yellow-500";
  return "bg-gradient-to-r from-emerald-400 to-emerald-500";
}

function getProgressColor(used: number, max: number): string {
  if (max === 0) return "bg-muted";
  const pct = (used / max) * 100;
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-orange-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-emerald-500";
}

function getSizeBadgeColor(size: string | null): string {
  switch (size) {
    case "S": return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    case "M": return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
    case "L": return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
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

function parseTimeToHours(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + (m || 0) / 60;
}

// ──────────── SHARED COMPONENTS ────────────

function PointsBar({ used, max, className = "" }: { used: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[30px]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getProgressGradient(used, max)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{used}/{max}</span>
    </div>
  );
}

// Compact appointment card for week view cells
function CompactCard({ appt, onClick }: { appt: WeekSlotAppointment; onClick?: () => void }) {
  const catStyle = getCategoryStyle(appt.goodsType);
  const isCancelled = appt.confirmationStatus === "cancelled";
  const isConfirmed = appt.confirmationStatus === "confirmed";
  const pts = getSizePoints(appt.size);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`w-full text-left p-1.5 rounded-md text-[10px] leading-tight border-l-[3px] ${catStyle.border} ${catStyle.bg} shadow-sm hover:shadow-md transition-all duration-150 ${isCancelled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-0.5">
        {isConfirmed && <Check className="h-2.5 w-2.5 text-emerald-600 shrink-0" />}
        {isCancelled && <X className="h-2.5 w-2.5 text-red-500 shrink-0" />}
        <span className={`font-semibold truncate ${isCancelled ? "line-through" : ""}`}>{appt.providerName}</span>
      </div>
      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
        {appt.goodsType && (
          <span className={`font-medium ${catStyle.text} truncate max-w-[70px]`}>{appt.goodsType}</span>
        )}
        {appt.size && (
          <span className={`inline-flex px-1 rounded text-[9px] font-bold ${getSizeBadgeColor(appt.size)}`}>{appt.size}·{pts}pt</span>
        )}
        {appt.dockCode && (
          <span className="px-1 rounded text-[9px] font-mono bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{appt.dockCode}</span>
        )}
      </div>
    </button>
  );
}

// Full appointment card for day view
function FullCard({ appt, onClick }: { appt: WeekSlotAppointment; onClick?: () => void }) {
  const catStyle = getCategoryStyle(appt.goodsType);
  const isCancelled = appt.confirmationStatus === "cancelled";
  const isConfirmed = appt.confirmationStatus === "confirmed";
  const pts = getSizePoints(appt.size);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      className={`w-full text-left p-3 rounded-lg border-l-4 ${catStyle.border} bg-card border border-border/50 hover:shadow-lg transition-all duration-200 ${isCancelled ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm flex items-center gap-1.5">
          {isConfirmed && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
          {isCancelled && <X className="h-3.5 w-3.5 text-red-500 shrink-0" />}
          <span className={isCancelled ? "line-through" : ""}>{appt.providerName}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {appt.size && (
            <Badge variant="outline" className={`text-[10px] font-bold ${getSizeBadgeColor(appt.size)}`}>
              {appt.size} · {pts}pts
            </Badge>
          )}
          {appt.dockCode && (
            <Badge variant="outline" className="text-[10px] font-mono bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200">
              {appt.dockCode}
            </Badge>
          )}
        </div>
      </div>
      {appt.goodsType && (
        <div className={`text-xs font-medium mt-1.5 flex items-center gap-1.5 ${catStyle.text}`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${catStyle.dot}`} />
          {appt.goodsType}
        </div>
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

// ──────────── WEEK VIEW — Time-Grid Layout (FIX 2 + MEJORA 3) ────────────

const HOUR_PX = 70;

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
  const timeRange = useMemo(() => {
    let minH = 24, maxH = 0;
    for (const day of weekData) {
      for (const slot of day.slots) {
        const sh = parseTimeToHours(slot.startTime);
        const eh = parseTimeToHours(slot.endTime);
        if (sh < minH) minH = sh;
        if (eh > maxH) maxH = eh;
      }
    }
    if (minH >= maxH) return { start: 8, end: 20 };
    return { start: Math.floor(minH), end: Math.ceil(maxH) };
  }, [weekData]);

  const totalHours = timeRange.end - timeRange.start;
  const gridHeight = totalHours * HOUR_PX;
  const today = toMadridDateStr(new Date());

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

  if (weekData.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay franjas configuradas para esta semana.
      </Card>
    );
  }

  const cols = weekData.length;

  return (
    <Card className="overflow-hidden" data-testid="slot-calendar-week">
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(840, cols * 150 + 56) }}>
          {/* ── Day Headers ── */}
          <div
            className="grid border-b"
            style={{ gridTemplateColumns: `56px repeat(${cols}, 1fr)` }}
          >
            <div className="p-2 border-r bg-muted/30" />
            {weekData.map((day) => {
              const dUsed = day.slots.reduce((s, sl) => s + sl.usedPoints, 0);
              const dMax = day.slots.reduce((s, sl) => s + sl.maxPoints, 0);
              const isToday = day.date === today;
              return (
                <div
                  key={day.date}
                  className={`px-2 py-2.5 text-center border-r last:border-r-0 ${isToday ? "bg-primary/5" : "bg-muted/30"}`}
                >
                  <div className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {day.dayName}
                  </div>
                  <div className={`text-base font-bold ${isToday ? "text-primary" : ""}`}>
                    {format(new Date(day.date + "T12:00:00"), "dd", { locale: es })}
                  </div>
                  <PointsBar used={dUsed} max={dMax} className="mt-1" />
                </div>
              );
            })}
          </div>

          {/* ── Time Grid + Day Columns ── */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `56px repeat(${cols}, 1fr)` }}
          >
            {/* Time gutter */}
            <div className="border-r bg-muted/10 relative" style={{ height: gridHeight }}>
              {Array.from({ length: totalHours + 1 }, (_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 flex items-start justify-end pr-1.5"
                  style={{ top: i * HOUR_PX - 6 }}
                >
                  <span className="text-[10px] font-mono text-muted-foreground leading-none">
                    {String(timeRange.start + i).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekData.map((day) => {
              const isToday = day.date === today;
              return (
                <div
                  key={day.date}
                  className={`border-r last:border-r-0 relative ${isToday ? "bg-primary/[0.02]" : ""}`}
                  style={{ height: gridHeight }}
                >
                  {/* Hour grid lines */}
                  {Array.from({ length: totalHours }, (_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-dashed border-border/40"
                      style={{ top: (i + 1) * HOUR_PX }}
                    />
                  ))}

                  {/* Slot blocks — positioned by actual time (FIX 2: no ghost rows) */}
                  {day.slots.map((slot) => {
                    const sH = parseTimeToHours(slot.startTime);
                    const eH = parseTimeToHours(slot.endTime);
                    const top = (sH - timeRange.start) * HOUR_PX;
                    const height = (eH - sH) * HOUR_PX;
                    const isFull = slot.availablePoints <= 0;
                    const canClick = !readOnly && !isFull;

                    return (
                      <div
                        key={`${slot.startTime}-${slot.endTime}`}
                        className={`absolute left-1 right-1 rounded-lg border overflow-hidden transition-all duration-200 ${getOccupationBg(slot.usedPoints, slot.maxPoints)} ${canClick ? "cursor-pointer hover:shadow-md" : ""}`}
                        style={{ top: top + 1, height: height - 2 }}
                        onClick={() => canClick && onSlotClick?.(day.date, slot.startTime, slot.endTime)}
                      >
                        <div className="p-1.5 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-1 shrink-0">
                            <span className="text-[9px] font-mono font-medium text-muted-foreground">
                              {slot.startTime}–{slot.endTime}
                            </span>
                            <PointsBar used={slot.usedPoints} max={slot.maxPoints} className="max-w-[80px]" />
                          </div>
                          <div className="flex-1 overflow-hidden relative">
                            <div className="space-y-1 h-full overflow-y-auto">
                              {slot.appointments.slice(0, 3).map((appt) => (
                                <CompactCard
                                  key={appt.id}
                                  appt={appt}
                                  onClick={() => onAppointmentClick?.(appt)}
                                />
                              ))}
                            </div>
                            {slot.appointments.length > 3 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent pt-4 pb-0.5 text-center">
                                <span className="text-[9px] font-semibold text-primary">+{slot.appointments.length - 3} más</span>
                              </div>
                            )}
                            {slot.appointments.length > 0 && slot.appointments.length <= 3 && (
                              <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-background/50 to-transparent pointer-events-none" />
                            )}
                          </div>
                          {slot.appointments.length === 0 && canClick && (
                            <div className="flex items-center justify-center flex-1 opacity-15 hover:opacity-50 transition-opacity">
                              <div className="flex flex-col items-center gap-0.5">
                                <Plus className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[8px] text-muted-foreground font-medium">Libre</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ──────────── DAY VIEW — Enhanced (MEJORA 5) ────────────

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
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Clock className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <p>No hay franjas configuradas para {format(currentDate, "EEEE dd/MM/yyyy", { locale: es })}.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="slot-calendar-day">
      {dayData.slots.map((slot) => {
        const isFull = slot.availablePoints <= 0;
        const pct = slot.maxPoints > 0 ? Math.round((slot.usedPoints / slot.maxPoints) * 100) : 0;

        return (
          <Card
            key={`${slot.startTime}-${slot.endTime}`}
            className={`overflow-hidden border ${getOccupationBorderColor(slot.usedPoints, slot.maxPoints)}`}
          >
            {/* Slot header */}
            <div className={`px-4 py-3 flex items-center justify-between border-b ${getOccupationBg(slot.usedPoints, slot.maxPoints)}`}>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-mono font-bold">
                    {slot.startTime} – {slot.endTime}
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {slot.usedPoints}/{slot.maxPoints} pts
                </Badge>
                <span className={`text-sm font-semibold ${pct >= 80 ? "text-red-600 dark:text-red-400" : pct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {pct}%
                </span>
                {slot.activeDocks !== undefined && slot.activeDocks > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {slot.activeDocks} muelles
                  </Badge>
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
                        className="shrink-0"
                        data-testid={`button-add-appt-${slot.startTime}`}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Añadir
                      </Button>
                    </TooltipTrigger>
                    {isFull && <TooltipContent>Franja completa</TooltipContent>}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-muted">
              <div
                className={`h-full transition-all duration-500 ${getProgressGradient(slot.usedPoints, slot.maxPoints)}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>

            {/* Appointments */}
            <div className={slot.appointments.length === 0 ? "px-4 py-2" : "p-4"}>
              {slot.appointments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-1 italic">
                  Franja libre — {slot.availablePoints} pts disponibles
                </p>
              ) : (
                <div className="space-y-2">
                  {slot.appointments.map((appt) => (
                    <FullCard
                      key={appt.id}
                      appt={appt}
                      onClick={() => onAppointmentClick?.(appt)}
                    />
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ──────────── MONTH VIEW — Enriched (MEJORA 4) ────────────

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

  const dayLookup = useMemo(() => {
    const map = new Map<string, {
      appointments: number;
      usedPoints: number;
      maxPoints: number;
      providerNames: string[];
    }>();
    for (const day of weekData) {
      let totalUsed = 0;
      let totalMax = 0;
      let totalAppts = 0;
      const providers: string[] = [];
      for (const slot of day.slots) {
        totalUsed += slot.usedPoints;
        totalMax += slot.maxPoints;
        totalAppts += slot.appointments.length;
        for (const appt of slot.appointments) {
          if (appt.providerName && !providers.includes(appt.providerName)) {
            providers.push(appt.providerName);
          }
        }
      }
      map.set(day.date, {
        appointments: totalAppts,
        usedPoints: totalUsed,
        maxPoints: totalMax,
        providerNames: providers,
      });
    }
    return map;
  }, [weekData]);

  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
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
          <div key={dh} className="p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
            {dh}
          </div>
        ))}
        {calendarWeeks.map((week) =>
          week.map((day) => {
            const dateStr = toMadridDateStr(day);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = dateStr === today;
            const info = dayLookup.get(dateStr);
            const pct = info && info.maxPoints > 0 ? Math.round((info.usedPoints / info.maxPoints) * 100) : 0;

            let cellBg = "";
            if (info && info.maxPoints > 0) {
              if (pct >= 80) cellBg = "bg-red-50/60 dark:bg-red-950/20";
              else if (pct >= 50) cellBg = "bg-yellow-50/60 dark:bg-yellow-950/15";
              else if (pct > 0) cellBg = "bg-emerald-50/40 dark:bg-emerald-950/10";
            }

            return (
              <button
                key={dateStr}
                className={`p-1.5 sm:p-2 border-b border-r text-left min-h-[60px] sm:min-h-[90px] transition-all duration-150 hover:bg-muted/40 ${
                  isCurrentMonth ? "" : "opacity-30"
                } ${isToday ? "ring-2 ring-inset ring-primary/40" : ""} ${cellBg}`}
                onClick={() => onDayClick(day)}
              >
                <div className={`text-xs sm:text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                  {day.getDate()}
                </div>
                {/* Mobile: dot indicator for days with appointments */}
                {info && isCurrentMonth && info.appointments > 0 && (
                  <div className="flex gap-0.5 mt-0.5 sm:hidden">
                    <span className={`w-1.5 h-1.5 rounded-full ${getProgressColor(info.usedPoints, info.maxPoints)}`} />
                  </div>
                )}
                {info && isCurrentMonth && info.maxPoints > 0 && info.appointments > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {/* Occupation bar + percentage */}
                    <div className="hidden sm:flex items-center gap-1">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getProgressColor(info.usedPoints, info.maxPoints)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-bold ${
                        pct >= 80 ? "text-red-600 dark:text-red-400" : pct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400"
                      }`}>{pct}%</span>
                    </div>
                    {/* Count */}
                    <div className="text-[10px] text-muted-foreground">
                      {info.appointments} cita{info.appointments !== 1 ? "s" : ""}
                    </div>
                    {/* Provider names (up to 2) — hidden on mobile */}
                    {info.providerNames.length > 0 && (
                      <div className="space-y-0 hidden sm:block">
                        {info.providerNames.slice(0, 2).map((name) => (
                          <div key={name} className="text-[9px] text-foreground/70 truncate leading-tight">
                            {name}
                          </div>
                        ))}
                        {info.providerNames.length > 2 && (
                          <div className="text-[9px] text-muted-foreground font-medium">
                            +{info.providerNames.length - 2} más
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {info && isCurrentMonth && info.maxPoints === 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground italic">Cerrado</div>
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
  // P0-3: On mobile (<640px), auto-redirect week view to day view
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile && currentView === "week") {
      onViewChange("day");
    }
  }, [isMobile, currentView, onViewChange]);

  const queryDate = useMemo(() => {
    return toMadridDateStr(currentDate);
  }, [currentDate]);

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
    let text: string;
    if (currentView === "day") {
      text = format(currentDate, "EEEE dd 'de' MMMM yyyy", { locale: es });
    } else if (currentView === "month") {
      text = format(currentDate, "MMMM yyyy", { locale: es });
    } else if (weekData.length >= 2) {
      const first = weekData[0].date;
      const last = weekData[weekData.length - 1].date;
      text = `${format(new Date(first + "T12:00:00"), "dd MMM", { locale: es })} — ${format(new Date(last + "T12:00:00"), "dd MMM yyyy", { locale: es })}`;
    } else {
      text = format(currentDate, "MMMM yyyy", { locale: es });
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
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
          <h2 className="text-xl font-semibold ml-2">{titleText}</h2>
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
            className={`rounded-full ${isMobile ? "hidden" : ""}`}
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
