import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarView } from "@/components/calendar-view";
import { CapacityIndicators } from "@/components/capacity-indicators";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConflictErrorDialog } from "@/components/conflict-error-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { appointmentsApi, providersApi, capacityApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Provider, CreateAppointmentInput, UpdateAppointmentInput, CapacityConflictError, UserRole, CapacityUtilization } from "@shared/types";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

interface CalendarPageProps {
  userRole: UserRole;
}

export default function CalendarPage({ userRole }: CalendarPageProps) {
  const { toast } = useToast();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [conflictErrorOpen, setConflictErrorOpen] = useState(false);
  const [conflictError, setConflictError] = useState<CapacityConflictError | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<"dayGridMonth" | "timeGridWeek" | "timeGridDay">("timeGridWeek");
  
  // Store the actual date range from FullCalendar
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>(() => {
    // Initialize with week range for default view
    return {
      startDate: startOfWeek(new Date(), { weekStartsOn: 1 }),
      endDate: endOfWeek(new Date(), { weekStartsOn: 1 }),
    };
  });

  const isReadOnly = userRole === "BASIC_READONLY";

  // Use the date range from FullCalendar
  const { startDate, endDate } = dateRange;

  // Fetch appointments
  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
    queryFn: () => appointmentsApi.list(),
  });

  // Fetch providers
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    queryFn: () => providersApi.list(),
  });

  // Fetch capacity utilization for current date range
  const { data: capacityUtilization } = useQuery<CapacityUtilization>({
    queryKey: ["/api/capacity/utilization", startDate.toISOString(), endDate.toISOString()],
    queryFn: () => capacityApi.getUtilization({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }),
  });

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) => appointmentsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      // Invalidate all capacity queries
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/utilization"], exact: false });
      setAppointmentDialogOpen(false);
      setSelectedEvent(null);
      toast({
        title: "Éxito",
        description: "Cita creada correctamente",
      });
    },
    onError: (error: any) => {
      // Check if it's a capacity conflict error
      if (error.message?.includes("Capacity conflict")) {
        try {
          const errorData = JSON.parse(error.message.split(": ")[1]);
          setConflictError(errorData);
          setConflictErrorOpen(true);
        } catch {
          toast({
            title: "Error",
            description: error.message || "Error al crear la cita",
            variant: "destructive",
          });
        }
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
      // Invalidate all capacity queries
      queryClient.invalidateQueries({ queryKey: ["/api/capacity/utilization"], exact: false });
      setAppointmentDialogOpen(false);
      setSelectedEvent(null);
      toast({
        title: "Éxito",
        description: "Cita actualizada correctamente",
      });
    },
    onError: (error: any) => {
      // Check if it's a capacity conflict error
      if (error.message?.includes("Capacity conflict")) {
        try {
          const errorData = JSON.parse(error.message.split(": ")[1]);
          setConflictError(errorData);
          setConflictErrorOpen(true);
        } catch {
          toast({
            title: "Error",
            description: error.message || "Error al actualizar la cita",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: error.message || "Error al actualizar la cita",
          variant: "destructive",
        });
      }
    },
  });

  // Convert appointments to FullCalendar events
  const events = appointments.map(apt => ({
    id: apt.id,
    title: apt.providerName,
    start: apt.startUtc,
    end: apt.endUtc,
    backgroundColor: '#0066cc',
    borderColor: '#0052a3',
    extendedProps: {
      ...apt,
    },
  }));

  const handleEventClick = (eventClickInfo: any) => {
    if (!isReadOnly) {
      setSelectedEvent(eventClickInfo.event);
      setAppointmentDialogOpen(true);
    }
  };

  const handleDateSelect = (selectInfo: any) => {
    if (!isReadOnly) {
      setSelectedEvent(null);
      setAppointmentDialogOpen(true);
    }
  };

  const handleEventDrop = (eventDropInfo: any) => {
    const event = eventDropInfo.event;
    const appointmentId = event.id;
    
    // Update appointment with new start and end times
    updateMutation.mutate({
      id: appointmentId,
      input: {
        start: event.start.toISOString(),
        end: event.end.toISOString(),
      },
    }, {
      onError: () => {
        // Revert the drop if there's an error
        eventDropInfo.revert();
      },
    });
  };

  const handleSaveAppointment = (data: any) => {
    if (selectedEvent && selectedEvent.id) {
      // Update existing appointment
      updateMutation.mutate({ id: selectedEvent.id, input: data });
    } else {
      // Create new appointment
      createMutation.mutate(data);
    }
  };

  // Callback handlers for calendar navigation
  const handleViewChange = (view: "dayGridMonth" | "timeGridWeek" | "timeGridDay") => {
    setCurrentView(view);
  };

  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
  };

  // Handle when FullCalendar changes its date range
  const handleDatesChange = (start: Date, end: Date, viewType: "dayGridMonth" | "timeGridWeek" | "timeGridDay") => {
    setDateRange({ startDate: start, endDate: end });
    setCurrentView(viewType);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Calendario</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona las citas y la capacidad del almacén
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => {
            setSelectedEvent(null);
            setAppointmentDialogOpen(true);
          }} data-testid="button-new-appointment">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cita
          </Button>
        )}
      </div>

      {capacityUtilization && (
        <CapacityIndicators
          appointmentCount={capacityUtilization.appointmentCount}
          capacityPercentage={capacityUtilization.capacityPercentage}
          workersPercentage={capacityUtilization.workersPercentage}
          forkliftsPercentage={capacityUtilization.forkliftsPercentage}
          docksPercentage={capacityUtilization.docksPercentage}
          peakDay={capacityUtilization.peakDay}
          peakPercentage={capacityUtilization.peakPercentage}
          daysUsingDefaults={capacityUtilization.daysUsingDefaults}
          defaultDaysBreakdown={capacityUtilization.defaultDaysBreakdown}
        />
      )}

      <CalendarView
        events={events}
        onEventClick={handleEventClick}
        onDateSelect={handleDateSelect}
        onEventDrop={handleEventDrop}
        onViewChange={handleViewChange}
        onDateChange={handleDateChange}
        onDatesChange={handleDatesChange}
        readOnly={isReadOnly}
      />

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        appointment={selectedEvent?.extendedProps as any}
        providers={providers}
        onSave={handleSaveAppointment}
      />

      <ConflictErrorDialog
        open={conflictErrorOpen}
        onOpenChange={setConflictErrorOpen}
        error={conflictError}
      />
    </div>
  );
}
