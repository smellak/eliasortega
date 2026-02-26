import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useElapsedTimer, formatElapsed } from "@/hooks/use-elapsed-timer";
import { CheckoutModal } from "./checkout-modal";
import type { Appointment } from "@shared/types";
import type { UserRole } from "@shared/types";

interface WarehouseCardProps {
  appointment: Appointment;
  userRole: UserRole;
  isToday: boolean;
  onCheckin: (id: string) => void;
  onCheckout: (id: string, actualUnits?: number) => void;
  onUndoCheckin: (id: string) => void;
  isLoading: boolean;
}

type CardState = "pending" | "in_progress" | "completed" | "cancelled";

function getCardState(a: Appointment): CardState {
  if (a.cancelledAt) return "cancelled";
  if (a.actualEndUtc) return "completed";
  if (a.actualStartUtc) return "in_progress";
  return "pending";
}

function formatTime(utc: string): string {
  return new Date(utc).toLocaleTimeString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const borderColors: Record<CardState, string> = {
  pending: "border-l-gray-400",
  in_progress: "border-l-blue-500",
  completed: "border-l-green-500",
  cancelled: "border-l-red-400",
};

const stateLabels: Record<CardState, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const stateBadgeVariants: Record<CardState, "secondary" | "default" | "outline" | "destructive"> = {
  pending: "secondary",
  in_progress: "default",
  completed: "outline",
  cancelled: "destructive",
};

export function WarehouseCard({
  appointment,
  userRole,
  isToday,
  onCheckin,
  onCheckout,
  onUndoCheckin,
  isLoading,
}: WarehouseCardProps) {
  const state = getCardState(appointment);
  const elapsed = useElapsedTimer(state === "in_progress" ? appointment.actualStartUtc : null);
  const [showCheckout, setShowCheckout] = useState(false);

  const handleCheckoutConfirm = (actualUnits?: number) => {
    onCheckout(appointment.id, actualUnits);
    setShowCheckout(false);
  };

  return (
    <>
      <Card
        className={`border-l-4 ${borderColors[state]} ${state === "cancelled" ? "opacity-60" : ""} ${state === "in_progress" ? "ring-1 ring-blue-500/30" : ""}`}
      >
        <div className="p-4 space-y-3">
          {/* Header: provider name + state badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold truncate">{appointment.providerName}</h3>
              <p className="text-sm text-muted-foreground">
                {formatTime(appointment.startUtc)} – {formatTime(appointment.endUtc)}
                {appointment.dockName && (
                  <span className="ml-2 font-medium">· {appointment.dockName}</span>
                )}
              </p>
            </div>
            <Badge variant={stateBadgeVariants[state]}>{stateLabels[state]}</Badge>
          </div>

          {/* Details row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {appointment.goodsType && <span>{appointment.goodsType}</span>}
            {appointment.units != null && <span>{appointment.units} uds</span>}
            <span>{appointment.workMinutesNeeded} min estimados</span>
          </div>

          {/* IN PROGRESS: timer */}
          {state === "in_progress" && (
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Tiempo transcurrido</p>
              <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {formatElapsed(elapsed)}
              </p>
            </div>
          )}

          {/* COMPLETED: actual vs estimated */}
          {state === "completed" && appointment.actualDurationMin != null && (
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
              <div className="flex justify-between items-center text-sm">
                <span>Real: <span className="font-bold">{Math.round(appointment.actualDurationMin)} min</span></span>
                <span>Estimado: <span className="font-medium">{appointment.workMinutesNeeded} min</span></span>
                {appointment.predictionErrorMin != null && (
                  <Badge variant={Math.abs(appointment.predictionErrorMin) > 30 ? "destructive" : "secondary"} className="text-xs">
                    {appointment.predictionErrorMin > 0 ? "+" : ""}{Math.round(appointment.predictionErrorMin)} min
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Actions — only on today */}
          {isToday && state === "pending" && (
            <Button
              onClick={() => onCheckin(appointment.id)}
              disabled={isLoading}
              className="w-full min-h-[60px] text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white"
            >
              Ha llegado
            </Button>
          )}

          {isToday && state === "in_progress" && (
            <Button
              onClick={() => setShowCheckout(true)}
              disabled={isLoading}
              className="w-full min-h-[60px] text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
            >
              Ha terminado
            </Button>
          )}

          {isToday && state === "completed" && (userRole === "ADMIN" || userRole === "PLANNER") && (
            <Button
              variant="outline"
              onClick={() => onUndoCheckin(appointment.id)}
              disabled={isLoading}
              className="w-full min-h-[48px] text-sm"
            >
              Deshacer registro
            </Button>
          )}
        </div>
      </Card>

      <CheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        onConfirm={handleCheckoutConfirm}
        expectedUnits={appointment.units}
        providerName={appointment.providerName}
      />
    </>
  );
}
