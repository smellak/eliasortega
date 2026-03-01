import React, { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { slotsApi, type WeekDay, type WeekSlot, type WeekSlotAppointment } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, Clock, Check, X, Moon, Info } from "lucide-react";
import { format, addDays, addWeeks, subWeeks, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, getISOWeek } from "date-fns";
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
  "Asientos":    { bg: "bg-violet-50 dark:bg-violet-950/30",   border: "border-l-violet-500 dark:border-l-violet-400",  text: "text-violet-700 dark:text-violet-300",  dot: "bg-violet-500" },
  "Baño":        { bg: "bg-cyan-50 dark:bg-cyan-950/30",       border: "border-l-cyan-500 dark:border-l-cyan-400",    text: "text-cyan-700 dark:text-cyan-300",      dot: "bg-cyan-500" },
  "Cocina":      { bg: "bg-amber-50 dark:bg-amber-950/30",     border: "border-l-amber-500 dark:border-l-amber-400",   text: "text-amber-700 dark:text-amber-300",    dot: "bg-amber-500" },
  "Colchonería": { bg: "bg-indigo-50 dark:bg-indigo-950/30",   border: "border-l-indigo-500 dark:border-l-indigo-400",  text: "text-indigo-700 dark:text-indigo-300",  dot: "bg-indigo-500" },
  "Electro":     { bg: "bg-yellow-50 dark:bg-yellow-950/30",   border: "border-l-yellow-500 dark:border-l-yellow-400",  text: "text-yellow-700 dark:text-yellow-300",  dot: "bg-yellow-500" },
  "Mobiliario":  { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-l-emerald-500 dark:border-l-emerald-400", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  "PAE":         { bg: "bg-orange-50 dark:bg-orange-950/30",   border: "border-l-orange-500 dark:border-l-orange-400",  text: "text-orange-700 dark:text-orange-300",  dot: "bg-orange-500" },
  "Tapicería":   { bg: "bg-rose-50 dark:bg-rose-950/30",       border: "border-l-rose-500 dark:border-l-rose-400",    text: "text-rose-700 dark:text-rose-300",      dot: "bg-rose-500" },
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
      className={`w-full text-left p-1.5 rounded-md text-[10px] leading-tight border-l-[3px] ${catStyle.border} ${catStyle.bg} shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 ${isCancelled ? "opacity-50" : ""}`}
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
      className={`w-full text-left p-3 rounded-lg border-l-4 ${catStyle.border} bg-card border border-border/50 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 ${isCancelled ? "opacity-60" : ""}`}
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
    <Card className="overflow-hidden relative" data-testid="slot-calendar-week">
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none z-10" />
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
              const dPct = dMax > 0 ? Math.round((dUsed / dMax) * 100) : 0;
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
                    {format(new Date(day.date + "T12:00:00"), "dd/MM", { locale: es })}
                  </div>
                  {dMax > 0 && (
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[60px]">
                        <div
                          className={`h-full rounded-full ${getProgressColor(dUsed, dMax)}`}
                          style={{ width: `${Math.max(Math.min(dPct, 100), dPct > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-bold ${
                        dPct >= 80 ? "text-red-600 dark:text-red-400" : dPct >= 50 ? "text-yellow-600 dark:text-yellow-400" : dPct > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}>{dUsed}/{dMax}</span>
                    </div>
                  )}
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
                  style={{ top: i * HOUR_PX - 7 }}
                >
                  <span className="text-[10px] font-mono text-muted-foreground leading-none select-none">
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
                        className={`absolute left-1 right-1 rounded-lg border overflow-hidden transition-all duration-200 ${getOccupationBg(slot.usedPoints, slot.maxPoints)} ${canClick ? "cursor-pointer hover:shadow-md hover:ring-2 hover:ring-primary/20" : ""}`}
                        style={{ top: top + 1, height: height - 2 }}
                        onClick={() => canClick && onSlotClick?.(day.date, slot.startTime, slot.endTime)}
                      >
                        <div className="p-1.5 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-1 shrink-0">
                            <span className="text-[9px] font-mono font-medium text-muted-foreground">
                              {slot.startTime}–{slot.endTime}
                            </span>
                            <PointsBar used={slot.usedPoints} max={slot.maxPoints} className="max-w-[95px]" />
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
                            <div className="flex items-center justify-center flex-1 opacity-30 dark:opacity-40 hover:opacity-60 transition-opacity">
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

// ──────────── MOBILE WEEK VIEW — Vertical agenda cards ────────────

function MobileWeekView({
  weekData,
  isLoading,
  onDayClick,
  onAppointmentClick,
}: {
  weekData: WeekDay[];
  isLoading: boolean;
  onDayClick: (date: Date) => void;
  onAppointmentClick?: (appointment: WeekSlotAppointment) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-4">
            <div className="space-y-2">
              <div className="h-5 rounded w-1/3 skeleton-shimmer" />
              <div className="h-3 rounded w-full skeleton-shimmer" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {weekData.map((day) => {
        const allAppts = day.slots.flatMap((s) => s.appointments);
        const totalUsed = day.slots.reduce((s, sl) => s + sl.usedPoints, 0);
        const totalMax = day.slots.reduce((s, sl) => s + sl.maxPoints, 0);
        const pct = totalMax > 0 ? Math.round((totalUsed / totalMax) * 100) : 0;
        const isSunday = day.dayOfWeek === 0;
        const hasSlots = day.slots.length > 0;
        const dayDate = new Date(day.date + "T12:00:00");
        const dayLabel = format(dayDate, "EEEE dd/MM", { locale: es });
        const isToday = day.date === toMadridDateStr(new Date());

        return (
          <Card
            key={day.date}
            className={`overflow-hidden transition-all ${isToday ? "ring-2 ring-primary/50" : ""} ${isSunday || !hasSlots ? "opacity-60" : ""}`}
          >
            {/* Day header — tappable to navigate to day view */}
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-accent/50 transition-colors"
              onClick={() => onDayClick(dayDate)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-sm font-semibold capitalize ${isToday ? "text-primary" : ""}`}>
                  {dayLabel}
                </span>
                {isToday && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">Hoy</Badge>
                )}
              </div>
              {isSunday ? (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Moon className="h-3 w-3" /> Cerrado
                </span>
              ) : hasSlots ? (
                <Badge variant="outline" className="text-xs shrink-0">
                  {allAppts.length} {allAppts.length === 1 ? "cita" : "citas"}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">Sin franjas</span>
              )}
            </button>

            {/* Occupancy bar */}
            {hasSlots && !isSunday && (
              <div className="px-4 pb-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              </div>
            )}

            {/* Appointments list */}
            {allAppts.length > 0 && (
              <div className="px-4 pb-3 space-y-1.5">
                {allAppts.map((appt) => {
                  const catStyle = getCategoryStyle(appt.goodsType);
                  const startTime = formatInTimeZone(new Date(appt.startUtc), MADRID_TZ, "HH:mm");
                  return (
                    <button
                      key={appt.id}
                      className={`w-full text-left flex items-center gap-2 p-2 rounded-md border-l-[3px] ${catStyle.border} ${catStyle.bg} hover:shadow-sm active:scale-[0.98] transition-all`}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(appt); }}
                    >
                      <span className="text-xs font-mono text-muted-foreground shrink-0 w-10">{startTime}</span>
                      <span className="text-xs font-medium truncate">{appt.providerName}</span>
                      {appt.goodsType && (
                        <span className={`text-[10px] ${catStyle.text} truncate`}>{appt.goodsType}</span>
                      )}
                      {appt.units && (
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">{appt.units}uds</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty day message */}
            {hasSlots && !isSunday && allAppts.length === 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs text-muted-foreground">Libre</p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
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
  const [emptyExpanded, setEmptyExpanded] = useState(false);

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
    const isSunday = currentDate.getDay() === 0;
    const isSaturday = currentDate.getDay() === 6;
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isSunday || isSaturday ? "bg-blue-50 dark:bg-blue-950/30" : "bg-muted/50"}`}>
            {isSunday || isSaturday ? (
              <Moon className="h-6 w-6 text-blue-400 dark:text-blue-300" />
            ) : (
              <Clock className="h-6 w-6 text-muted-foreground/50" />
            )}
          </div>
          <p className="font-medium">
            {isSunday || isSaturday
              ? `${format(currentDate, "EEEE", { locale: es })} — almacén cerrado`
              : `No hay franjas configuradas para ${format(currentDate, "EEEE dd/MM/yyyy", { locale: es })}.`
            }
          </p>
        </div>
      </Card>
    );
  }

  // Group slots: separate those with appointments from empty ones
  const slotsWithAppts = dayData.slots.filter(s => s.appointments.length > 0);
  const emptySlots = dayData.slots.filter(s => s.appointments.length === 0);
  const totalEmptyPts = emptySlots.reduce((s, sl) => s + sl.availablePoints, 0);
  const dockCount = dayData.slots[0]?.activeDocks || 0;

  // Render a single slot card (for slots with appointments or expanded empty)
  const renderSlotCard = (slot: WeekSlot, showDocks: boolean) => {
    const isFull = slot.availablePoints <= 0;
    const pct = slot.maxPoints > 0 ? Math.round((slot.usedPoints / slot.maxPoints) * 100) : 0;
    return (
      <Card
        key={`${slot.startTime}-${slot.endTime}`}
        className={`overflow-hidden border ${getOccupationBorderColor(slot.usedPoints, slot.maxPoints)}`}
      >
        <div className={`px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between border-b ${getOccupationBg(slot.usedPoints, slot.maxPoints)}`}>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              <span className="text-base sm:text-lg font-mono font-bold">
                {slot.startTime} – {slot.endTime}
              </span>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">
              {slot.usedPoints}/{slot.maxPoints} pts
            </Badge>
            <span className={`text-xs sm:text-sm font-semibold ${pct >= 80 ? "text-red-600 dark:text-red-400" : pct >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {pct}%
            </span>
            {showDocks && dockCount > 0 && (
              <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
                {dockCount} muelles
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
        <div className="h-1.5 bg-muted">
          <div
            className={`h-full transition-all duration-500 ${getProgressGradient(slot.usedPoints, slot.maxPoints)}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
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
  };

  return (
    <div className="space-y-3" data-testid="slot-calendar-day">
      {/* Day summary badge */}
      {dockCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[10px]">{dockCount} muelles activos</Badge>
          <span>{dayData.slots.length} franjas · {dayData.slots.reduce((s, sl) => s + sl.maxPoints, 0)} pts totales</span>
        </div>
      )}

      {/* Slots with appointments — always shown */}
      {slotsWithAppts.map((slot) => renderSlotCard(slot, false))}

      {/* Empty slots — collapsed when 3+ */}
      {emptySlots.length > 0 && emptySlots.length <= 2 && (
        emptySlots.map((slot) => renderSlotCard(slot, false))
      )}
      {emptySlots.length >= 3 && !emptyExpanded && (
        <Card
          className="overflow-hidden border border-dashed border-muted-foreground/20 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setEmptyExpanded(true)}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground/50" />
              <span className="text-sm font-medium text-muted-foreground">
                {emptySlots[0].startTime} – {emptySlots[emptySlots.length - 1].endTime}
              </span>
              <span className="text-xs text-muted-foreground">
                {emptySlots.length} franjas libres — {totalEmptyPts} pts disponibles
              </span>
            </div>
            <Button variant="ghost" size="sm" className="text-xs shrink-0">
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              Expandir
            </Button>
          </div>
        </Card>
      )}
      {emptySlots.length >= 3 && emptyExpanded && (
        <>
          <button
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            onClick={() => setEmptyExpanded(false)}
          >
            <ChevronUp className="h-3.5 w-3.5" />
            Colapsar {emptySlots.length} franjas vacías
          </button>
          {emptySlots.map((slot) => renderSlotCard(slot, false))}
        </>
      )}
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
      <div className="grid grid-cols-[28px_repeat(7,1fr)] sm:grid-cols-[36px_repeat(7,1fr)]">
        <div className="p-1 text-center text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/50 border-b bg-muted/30 flex items-center justify-center">
          Sem
        </div>
        {dayHeaders.map((dh) => (
          <div key={dh} className="p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b bg-muted/30">
            {dh}
          </div>
        ))}
        {calendarWeeks.map((week, weekIdx) => (
          <React.Fragment key={weekIdx}>
            <div className="p-1 border-b border-r bg-muted/10 flex items-center justify-center">
              <span className="text-[10px] font-mono text-muted-foreground/50">
                {getISOWeek(week[0])}
              </span>
            </div>
          {week.map((day) => {
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
                <div className="flex items-start">
                  <span className={`inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs sm:text-sm font-semibold ${
                    isToday
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : ""
                  }`}>
                    {day.getDate()}
                  </span>
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
                      <div className="space-y-0 hidden lg:block">
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
                {isCurrentMonth && info && info.maxPoints > 0 && info.appointments === 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground/50 hidden sm:block">
                    ○ {info.maxPoints} pts
                  </div>
                )}
                {isCurrentMonth && ((info && info.maxPoints === 0) || (!info && day.getDay() === 0)) && (
                  <div className="mt-1 text-[10px] text-muted-foreground italic hidden sm:block">Cerrado</div>
                )}
              </button>
            );
          })}
          </React.Fragment>
        ))}
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
  // Mobile detection for responsive views
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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

  // P3-3: Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "ArrowLeft":  e.preventDefault(); handlePrev(); break;
        case "ArrowRight": e.preventDefault(); handleNext(); break;
        case "t": handleToday(); break;
        case "w": onViewChange("week"); break;
        case "d": onViewChange("day"); break;
        case "m": onViewChange("month"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const titleText = useMemo(() => {
    let text: string;
    if (currentView === "day") {
      text = isMobile
        ? format(currentDate, "EEE dd MMM yyyy", { locale: es })
        : format(currentDate, "EEEE dd 'de' MMMM yyyy", { locale: es });
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
  }, [currentView, currentDate, weekData, isMobile]);

  return (
    <div className="space-y-4">
      {/* Navigation — compact: nav + toggles on one row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <Button variant="outline" size="sm" onClick={handlePrev} data-testid="button-calendar-prev" className="shrink-0 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-calendar-today" className="shrink-0 h-8 sm:h-9">
            Hoy
          </Button>
          <Button variant="outline" size="sm" onClick={handleNext} data-testid="button-calendar-next" className="shrink-0 h-8 w-8 p-0 sm:h-9 sm:w-auto sm:px-3">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-base sm:text-xl font-semibold ml-1 sm:ml-2 truncate">{titleText}</h2>
        </div>

        <div className="flex gap-0.5 rounded-full bg-muted p-0.5 sm:p-1 shrink-0">
          <Button
            variant={currentView === "month" ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-7 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm"
            onClick={() => onViewChange("month")}
            data-testid="button-view-month"
          >
            Mes
          </Button>
          <Button
            variant={currentView === "week" ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-7 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm"
            onClick={() => onViewChange("week")}
            data-testid="button-view-week"
          >
            Semana
          </Button>
          <Button
            variant={currentView === "day" ? "default" : "ghost"}
            size="sm"
            className="rounded-full h-7 px-2 sm:h-9 sm:px-3 text-xs sm:text-sm"
            onClick={() => onViewChange("day")}
            data-testid="button-view-day"
          >
            Día
          </Button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 sm:h-9 sm:w-9 p-0 shrink-0" data-testid="button-category-legend">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3" align="end">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Categorías</p>
            <div className="space-y-1.5">
              {Object.entries(CATEGORY_COLORS).map(([name, style]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* View Content — with fade-in transition (P3-1) */}
      {currentView === "week" && (
        <div key="week" className="animate-fadeIn">
        {isMobile ? (
          <MobileWeekView
            weekData={weekData}
            isLoading={isLoading}
            onDayClick={(date: Date) => { onDateChange(date); onViewChange("day"); }}
            onAppointmentClick={onAppointmentClick}
          />
        ) : (
          <WeekView
            weekData={weekData}
            isLoading={isLoading}
            onSlotClick={onSlotClick}
            onAppointmentClick={onAppointmentClick}
            readOnly={readOnly}
          />
        )}
        </div>
      )}
      {currentView === "day" && (
        <div key="day" className="animate-fadeIn">
        <DayView
          weekData={activeData}
          currentDate={currentDate}
          onSlotClick={onSlotClick}
          onAppointmentClick={onAppointmentClick}
          readOnly={readOnly}
          isLoading={isLoading}
        />
        </div>
      )}
      {currentView === "month" && (
        <div key="month" className="animate-fadeIn">
        <MonthView
          weekData={activeData}
          currentDate={currentDate}
          onDayClick={handleMonthDayClick}
          isLoading={isLoading}
        />
        </div>
      )}
    </div>
  );
}
