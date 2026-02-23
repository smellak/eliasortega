import { Card } from "@/components/ui/card";
import { Package, Gauge, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { SlotUtilization } from "@shared/types";

type CapacityIndicatorsProps = SlotUtilization;

export function CapacityIndicators({
  appointmentCount,
  slots,
  totalMaxPoints,
  totalPointsUsed,
  utilizationPercentage,
  peakSlot,
}: CapacityIndicatorsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getProgressClassName = (percentage: number) => {
    if (percentage >= 90) return "h-2.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-red-400 [&>div]:to-red-600";
    if (percentage >= 75) return "h-2.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-yellow-400 [&>div]:to-yellow-600";
    return "h-2.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-blue-400 [&>div]:to-blue-600";
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return "text-destructive";
    if (percentage >= 75) return "text-yellow-600 dark:text-yellow-500";
    return "text-primary";
  };

  // Group slots by date for display
  const slotsByDate = new Map<string, typeof slots>();
  for (const slot of slots) {
    const existing = slotsByDate.get(slot.date) || [];
    existing.push(slot);
    slotsByDate.set(slot.date, existing);
  }

  return (
    <div className="space-y-4">
      {/* Main Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Appointment Count */}
        <Card className="p-5" data-testid="card-appointment-count">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 flex items-center justify-center flex-shrink-0">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Citas de Descarga</p>
              <p className="text-3xl font-bold" data-testid="text-appointment-count">
                {appointmentCount}
              </p>
            </div>
          </div>
        </Card>

        {/* Utilization Percentage */}
        <Card className="p-5" data-testid="card-capacity-percentage">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 flex items-center justify-center flex-shrink-0">
              <Gauge className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">Ocupación por Slots</p>
              <p
                className={`text-3xl font-bold ${getPercentageColor(utilizationPercentage)}`}
                data-testid="text-capacity-percentage"
              >
                {utilizationPercentage.toFixed(1)}%
              </p>
              <Progress
                value={Math.min(utilizationPercentage, 100)}
                className={`mt-2 ${getProgressClassName(utilizationPercentage)}`}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {totalPointsUsed}/{totalMaxPoints} puntos totales
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Expandable Details */}
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
          <div className="mt-4 space-y-4" data-testid="container-capacity-details">
            {/* Peak Slot Info */}
            {peakSlot && (
              <div className="p-3 rounded-md bg-muted/50 flex items-center gap-3" data-testid="container-peak-slot">
                <TrendingUp className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Slot Pico</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-peak-slot-info">
                    {peakSlot.date} {peakSlot.startTime} - {peakSlot.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}

            {/* Slot Breakdown */}
            <div className="space-y-3">
              {slots.map((slot, idx) => {
                const pct = slot.maxPoints > 0 ? (slot.pointsUsed / slot.maxPoints) * 100 : 0;
                return (
                  <div key={`${slot.date}-${slot.startTime}-${idx}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
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
          </div>
        )}
      </Card>
    </div>
  );
}
