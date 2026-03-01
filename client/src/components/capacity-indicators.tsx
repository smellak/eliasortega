import { Card } from "@/components/ui/card";
import { Package, Gauge, TrendingUp, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { SlotUtilization } from "@shared/types";
import type { CalendarViewType } from "./slot-calendar";

type CapacityIndicatorsProps = SlotUtilization & {
  viewType?: CalendarViewType;
};

function getViewLabel(viewType?: CalendarViewType): string {
  switch (viewType) {
    case "day": return "hoy";
    case "month": return "este mes";
    default: return "esta semana";
  }
}

export function CapacityIndicators({
  appointmentCount,
  slots,
  totalMaxPoints,
  totalPointsUsed,
  utilizationPercentage,
  peakSlot,
  viewType,
}: CapacityIndicatorsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const viewLabel = getViewLabel(viewType);
  const freePoints = totalMaxPoints - totalPointsUsed;
  const freePercentage = totalMaxPoints > 0 ? (freePoints / totalMaxPoints) * 100 : 0;

  const getProgressClassName = (percentage: number) => {
    if (percentage >= 90) return "h-2 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-red-400 [&>div]:to-red-600";
    if (percentage >= 75) return "h-2 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-yellow-400 [&>div]:to-yellow-600";
    return "h-2 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-blue-400 [&>div]:to-blue-600";
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-destructive";
    if (percentage >= 75) return "text-yellow-600 dark:text-yellow-500";
    return "text-primary";
  };

  return (
    <div className="space-y-4">
      {/* ── 4 KPI Cards (MEJORA 7) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Citas de Descarga */}
        <Card className="p-4" data-testid="card-appointment-count">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Citas</p>
              <p className="text-2xl font-bold leading-tight" data-testid="text-appointment-count">
                {appointmentCount}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">{viewLabel}</p>
            </div>
          </div>
        </Card>

        {/* 2. Ocupación */}
        <Card className="p-4" data-testid="card-capacity-percentage">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 flex items-center justify-center shrink-0">
              <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Ocupación</p>
              <p
                className={`text-2xl font-bold leading-tight ${getPercentageColor(utilizationPercentage)}`}
                data-testid="text-capacity-percentage"
              >
                {utilizationPercentage.toFixed(1)}%
              </p>
              <Progress
                value={Math.min(utilizationPercentage, 100)}
                className={`mt-1 ${getProgressClassName(utilizationPercentage)}`}
              />
            </div>
          </div>
        </Card>

        {/* 3. Slot Pico (NEW) */}
        <Card className="p-4" data-testid="card-peak-slot">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Slot Pico</p>
              {peakSlot ? (
                <>
                  <p className={`text-2xl font-bold leading-tight ${getPercentageColor(peakSlot.percentage)}`}>
                    {peakSlot.percentage.toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {peakSlot.date.slice(5)} {peakSlot.startTime}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold leading-tight text-muted-foreground">—</p>
              )}
            </div>
          </div>
        </Card>

        {/* 4. Capacidad Disponible (NEW) */}
        <Card className="p-4" data-testid="card-free-capacity">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              freePercentage > 20
                ? "bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
                : "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900"
            }`}>
              <Zap className={`h-5 w-5 ${
                freePercentage > 20
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Disponible</p>
              <p className={`text-2xl font-bold leading-tight ${
                freePercentage > 20 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}>
                {freePoints}
              </p>
              <p className="text-[10px] text-muted-foreground">
                de {totalMaxPoints} pts
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Expandable Details ── */}
      <Card className="p-4">
        <Button
          variant="ghost"
          className="w-full justify-between gap-2"
          onClick={() => setShowDetails(!showDetails)}
          data-testid="button-toggle-details"
        >
          <span className="font-semibold">Detalles por Slot</span>
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showDetails && (
          <div className="mt-4 space-y-3" data-testid="container-capacity-details">
            {slots.map((slot, idx) => {
              const pct = slot.maxPoints > 0 ? (slot.pointsUsed / slot.maxPoints) * 100 : 0;
              return (
                <div key={`${slot.date}-${slot.startTime}-${idx}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-yellow-500" : "bg-blue-500"
                      }`} />
                      {slot.date} {slot.startTime}-{slot.endTime}
                    </span>
                    <span className={`text-sm font-mono ${getPercentageColor(pct)}`}>
                      {slot.pointsUsed}/{slot.maxPoints} pts
                    </span>
                  </div>
                  <Progress
                    value={Math.min(pct, 100)}
                    className={getProgressClassName(pct)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
