import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CalendarView } from "@/components/calendar-view";
import { CapacityIndicators } from "@/components/capacity-indicators";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConflictErrorDialog } from "@/components/conflict-error-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { appointmentsApi, providersApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Provider, CreateAppointmentInput, UpdateAppointmentInput, CapacityConflictError, UserRole } from "@shared/types";

interface CalendarPageProps {
  userRole: UserRole;
}

export default function CalendarPage({ userRole }: CalendarPageProps) {
  const { toast } = useToast();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [conflictErrorOpen, setConflictErrorOpen] = useState(false);
  const [conflictError, setConflictError] = useState<CapacityConflictError | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const isReadOnly = userRole === "BASIC_READONLY";

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

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateAppointmentInput) => appointmentsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setAppointmentDialogOpen(false);
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Appointment created successfully",
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
            description: error.message || "Failed to create appointment",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create appointment",
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
      setAppointmentDialogOpen(false);
      setSelectedEvent(null);
      toast({
        title: "Success",
        description: "Appointment updated successfully",
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
            description: error.message || "Failed to update appointment",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update appointment",
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

  // Calculate real-time capacity indicators (simplified - would need API call for real data)
  const capacityIndicators = {
    workUsed: 0,
    workAvailable: 3.0,
    forkliftsUsed: 0,
    forkliftsAvailable: 3,
    docksUsed: 0,
    docksAvailable: 3,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage warehouse appointments and capacity
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => {
            setSelectedEvent(null);
            setAppointmentDialogOpen(true);
          }} data-testid="button-new-appointment">
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        )}
      </div>

      <CapacityIndicators
        workUsed={capacityIndicators.workUsed}
        workAvailable={capacityIndicators.workAvailable}
        forkliftsUsed={capacityIndicators.forkliftsUsed}
        forkliftsAvailable={capacityIndicators.forkliftsAvailable}
        docksUsed={capacityIndicators.docksUsed}
        docksAvailable={capacityIndicators.docksAvailable}
      />

      <CalendarView
        events={events}
        onEventClick={handleEventClick}
        onDateSelect={handleDateSelect}
        onEventDrop={handleEventDrop}
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
