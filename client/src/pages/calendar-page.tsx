import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SlotCalendar, type CalendarViewType } from "@/components/slot-calendar";
import { CapacityIndicators } from "@/components/capacity-indicators";
import { QuickCapacityAdjust } from "@/components/quick-capacity-adjust";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConflictErrorDialog } from "@/components/conflict-error-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard-charts";
import { ExportPDFButton } from "@/components/export-pdf";
import { appointmentsApi, providersApi, capacityApi, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Provider, CreateAppointmentInput, UpdateAppointmentInput, UserRole, SlotUtilization } from "@shared/types";
import type { WeekSlotAppointment } from "@/lib/api";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";

interface CalendarPageProps {
  userRole: UserRole;
}

export default function CalendarPage({ userRole }: CalendarPageProps) {
  const { toast } = useToast();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [conflictErrorOpen, setConflictErrorOpen] = useState(false);
  const [conflictError, setConflictError] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<CalendarViewType>("week");
  // Pre-fill slot info when user clicks on a slot cell
  const [prefilledSlot, setPrefilledSlot] = useState<{ date: string; startTime: string; endTime: string } | null>(null);

  const isReadOnly = userRole === "BASIC_READONLY";

  // Date range for capacity utilization query
  const getDateRange = () => {
    if (currentView === "day") {
      return {
        startDate: startOfDay(currentDate),
        endDate: endOfDay(currentDate),
      };
    }
    if (currentView === "month") {
      return {
        startDate: startOfMonth(currentDate),
        endDate: endOfMonth(currentDate),
      };
    }
    return {
      startDate: startOfWeek(currentDate, { weekStartsOn: 1 }),
      endDate: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch providers
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    queryFn: () => providersApi.list(),
  });

  // Fetch capacity utilization for current date range
  const { data: capacityUtilization } = useQuery<SlotUtilization>({
    queryKey: ["/api/capacity/utilization", startDate.toISOString(), endDate.toISOString()],
    queryFn: () => capacityApi.getUtilization({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
  });

  // Fetch appointments (for PDF export)
  const { data: allAppointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    queryFn: () => appointmentsApi.list(),
  });

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) => appointmentsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slots/week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slots/week-month"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/utilization"], exact: false });
      setAppointmentDialogOpen(false);
      setSelectedAppointment(null);
      setPrefilledSlot(null);
      toast({
        title: "Cita creada",
        description: "La cita se ha creado correctamente",
      });
    },
    onError: (error: any) => {
      if (error instanceof ApiError && error.status === 409 && error.data?.conflict) {
        setConflictError(error.data.conflict);
        setConflictErrorOpen(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Error al crear la cita",
          variant: "destructive",
        });
      }
    },
  });

  // Update appointment mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAppointmentInput }) =>
      appointmentsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slots/week"] });
      queryClient.invalidateQueries({ queryKey: ["/api/slots/week-month"] });
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/utilization"], exact: false });
      setAppointmentDialogOpen(false);
      setSelectedAppointment(null);
      toast({
        title: "Cita actualizada",
        description: "La cita se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      if (error instanceof ApiError && error.status === 409 && error.data?.conflict) {
        setConflictError(error.data.conflict);
        setConflictErrorOpen(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Error al actualizar la cita",
          variant: "destructive",
        });
      }
    },
  });

  const handleSaveAppointment = (data: any) => {
    if (selectedAppointment?.id) {
      updateMutation.mutate({ id: selectedAppointment.id, input: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSlotClick = (date: string, startTime: string, endTime: string) => {
    setSelectedAppointment(null);
    setPrefilledSlot({ date, startTime, endTime });
    setAppointmentDialogOpen(true);
  };

  const handleAppointmentClick = (appt: WeekSlotAppointment) => {
    if (isReadOnly) return;
    // Build the appointment object expected by the dialog
    setSelectedAppointment({
      id: appt.id,
      providerId: appt.providerId || "",
      providerName: appt.providerName,
      startUtc: appt.startUtc,
      endUtc: appt.endUtc,
      workMinutesNeeded: appt.workMinutesNeeded,
      forkliftsNeeded: appt.forkliftsNeeded,
      goodsType: appt.goodsType,
      units: appt.units,
      lines: appt.lines,
      deliveryNotesCount: appt.deliveryNotesCount,
      providerEmail: appt.providerEmail,
      providerPhone: appt.providerPhone,
      confirmationStatus: appt.confirmationStatus,
      dockId: appt.dockId,
      dockCode: appt.dockCode,
      dockName: appt.dockName,
    });
    setPrefilledSlot(null);
    setAppointmentDialogOpen(true);
  };

  const handleNewAppointmentButton = () => {
    setSelectedAppointment(null);
    setPrefilledSlot(null);
    setAppointmentDialogOpen(true);
  };

  // Build appointment prop for dialog (with prefilled slot data)
  const dialogAppointment = selectedAppointment
    ? selectedAppointment
    : prefilledSlot
    ? {
        startUtc: `${prefilledSlot.date}T${prefilledSlot.startTime}:00`,
        endUtc: `${prefilledSlot.date}T${prefilledSlot.endTime}:00`,
        providerName: "",
        providerId: "",
        workMinutesNeeded: 60,
        forkliftsNeeded: 1,
      }
    : undefined;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="page-icon">
            <Calendar />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Calendario</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona las citas y la capacidad del almacén
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton appointments={allAppointments} currentDate={currentDate} viewType={currentView} />
          {!isReadOnly && (
            <QuickCapacityAdjust date={currentDate} />
          )}
          {!isReadOnly && (
            <Button
              className="gradient-btn text-white border-0 no-default-hover-elevate no-default-active-elevate"
              onClick={handleNewAppointmentButton}
              data-testid="button-new-appointment"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Nueva Cita</span>
            </Button>
          )}
        </div>
      </div>

      {capacityUtilization && (
        <CapacityIndicators
          appointmentCount={capacityUtilization.appointmentCount}
          slots={capacityUtilization.slots}
          totalMaxPoints={capacityUtilization.totalMaxPoints}
          totalPointsUsed={capacityUtilization.totalPointsUsed}
          utilizationPercentage={capacityUtilization.utilizationPercentage}
          peakSlot={capacityUtilization.peakSlot}
          viewType={currentView}
        />
      )}

      <SlotCalendar
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        currentView={currentView}
        onViewChange={setCurrentView}
        onSlotClick={handleSlotClick}
        onAppointmentClick={handleAppointmentClick}
        readOnly={isReadOnly}
      />

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={(open) => {
          setAppointmentDialogOpen(open);
          if (!open) {
            setSelectedAppointment(null);
            setPrefilledSlot(null);
          }
        }}
        appointment={dialogAppointment}
        providers={providers}
        onSave={handleSaveAppointment}
      />

      <DashboardCharts currentDate={currentDate} />

      <ConflictErrorDialog
        open={conflictErrorOpen}
        onOpenChange={setConflictErrorOpen}
        error={conflictError}
      />
    </div>
  );
}
