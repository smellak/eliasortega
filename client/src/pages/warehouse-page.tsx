import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi, warehouseApi } from "@/lib/api";
import { WarehouseCard } from "@/components/warehouse-card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UserRole, Appointment } from "@shared/types";

function getMadridDateStr(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
}

function getMadridDayName(date: Date): string {
  return date.toLocaleDateString("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function WarehousePage({ userRole }: { userRole: UserRole }) {
  const [dateOffset, setDateOffset] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const today = new Date();
  const viewDate = new Date(today);
  viewDate.setDate(viewDate.getDate() + dateOffset);
  const dateStr = getMadridDateStr(viewDate);
  const todayStr = getMadridDateStr(today);
  const isToday = dateStr === todayStr;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["warehouse-appointments", dateStr],
    queryFn: () => {
      const nextDay = new Date(viewDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const toStr = getMadridDateStr(nextDay);
      return appointmentsApi.list({ from: dateStr, to: toStr });
    },
    refetchInterval: 30000,
  });

  // Sort: in_progress first, then pending, then completed, then cancelled
  const sorted = [...appointments].sort((a, b) => {
    const order = (apt: Appointment) => {
      if (apt.cancelledAt) return 4;
      if (apt.actualEndUtc) return 3;
      if (apt.actualStartUtc) return 1;
      return 2;
    };
    const diff = order(a) - order(b);
    if (diff !== 0) return diff;
    return new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
  });

  const [actionLoading, setActionLoading] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["warehouse-appointments", dateStr] });
  };

  const checkinMutation = useMutation({
    mutationFn: (id: string) => warehouseApi.checkin(id),
    onSuccess: () => {
      toast({ title: "Llegada registrada" });
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "No se pudo registrar la llegada", variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: ({ id, actualUnits }: { id: string; actualUnits?: number }) => warehouseApi.checkout(id, actualUnits),
    onSuccess: () => {
      toast({ title: "Descarga completada" });
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "No se pudo completar la descarga", variant: "destructive" });
    },
  });

  const undoMutation = useMutation({
    mutationFn: (id: string) => warehouseApi.undoCheckin(id),
    onSuccess: () => {
      toast({ title: "Registro deshecho" });
      invalidate();
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "No se pudo deshacer", variant: "destructive" });
    },
  });

  const isBusy = checkinMutation.isPending || checkoutMutation.isPending || undoMutation.isPending;

  // Summary counts
  const inProgress = appointments.filter((a) => a.actualStartUtc && !a.actualEndUtc && !a.cancelledAt).length;
  const completed = appointments.filter((a) => a.actualEndUtc && !a.cancelledAt).length;
  const total = appointments.filter((a) => !a.cancelledAt).length;

  return (
    <div className="max-w-lg mx-auto px-4 pb-8">
      {/* Day navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setDateOffset((d) => d - 1)} className="h-12 w-12">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="text-center">
          <h1 className="text-lg font-bold capitalize">{getMadridDayName(viewDate)}</h1>
          {!isToday && (
            <button
              onClick={() => setDateOffset(0)}
              className="text-xs text-[#1565C0] dark:text-blue-300 underline"
            >
              Ir a hoy
            </button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setDateOffset((d) => d + 1)} className="h-12 w-12">
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground mb-6">
        {total} citas · {inProgress} en curso · {completed} completadas
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Sin citas este día</p>
          <p className="text-sm mt-1">Navega a otro día con las flechas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((appointment) => (
            <WarehouseCard
              key={appointment.id}
              appointment={appointment}
              userRole={userRole}
              isToday={isToday}
              onCheckin={(id) => checkinMutation.mutate(id)}
              onCheckout={(id, units) => checkoutMutation.mutate({ id, actualUnits: units })}
              onUndoCheckin={(id) => undoMutation.mutate(id)}
              isLoading={isBusy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
