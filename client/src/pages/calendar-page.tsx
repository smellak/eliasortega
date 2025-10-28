import { useState } from "react";
import { CalendarView } from "@/components/calendar-view";
import { CapacityIndicators } from "@/components/capacity-indicators";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConflictErrorDialog } from "@/components/conflict-error-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface CalendarPageProps {
  userRole: "admin" | "planner" | "basic_readonly";
}

export default function CalendarPage({ userRole }: CalendarPageProps) {
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [conflictErrorOpen, setConflictErrorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const isReadOnly = userRole === "basic_readonly";

  // TODO: remove mock data
  const events = [
    {
      id: '1',
      title: 'Acme Corp',
      start: '2025-10-28T09:00:00',
      end: '2025-10-28T11:00:00',
      backgroundColor: '#0066cc',
      borderColor: '#0052a3',
      extendedProps: {
        providerName: 'Acme Corp',
        workMinutesNeeded: 90,
        forkliftsNeeded: 2,
        goodsType: 'Electronics',
      },
    },
    {
      id: '2',
      title: 'Global Logistics',
      start: '2025-10-28T14:00:00',
      end: '2025-10-28T15:30:00',
      backgroundColor: '#0066cc',
      borderColor: '#0052a3',
      extendedProps: {
        providerName: 'Global Logistics',
        workMinutesNeeded: 60,
        forkliftsNeeded: 1,
      },
    },
    {
      id: '3',
      title: 'Fast Shipping Inc',
      start: '2025-10-29T10:00:00',
      end: '2025-10-29T12:00:00',
      backgroundColor: '#0066cc',
      borderColor: '#0052a3',
      extendedProps: {
        providerName: 'Fast Shipping Inc',
        workMinutesNeeded: 120,
        forkliftsNeeded: 2,
        goodsType: 'Furniture',
      },
    },
  ];

  const providers = [
    { id: '1', name: 'Acme Corp' },
    { id: '2', name: 'Global Logistics' },
    { id: '3', name: 'Fast Shipping Inc' },
  ];

  const mockConflictError = {
    minute: '2025-10-28T09:37:00Z',
    minuteMadrid: '2025-10-28 10:37',
    workUsed: 3.2,
    workAvailable: 3.0,
    forkliftsUsed: 3,
    forkliftsAvailable: 2,
    docksUsed: 2,
    docksAvailable: 3,
    failedRule: 'forklifts' as const,
  };

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
    console.log("Event dropped:", eventDropInfo);
    // TODO: Validate and update appointment
  };

  const handleSaveAppointment = (data: any) => {
    console.log("Saving appointment:", data);
    // TODO: Call API and handle conflict errors
    // For demo, show conflict error
    // setConflictErrorOpen(true);
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
        workUsed={2.5}
        workAvailable={3.0}
        forkliftsUsed={2}
        forkliftsAvailable={3}
        docksUsed={2}
        docksAvailable={3}
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
        appointment={selectedEvent?.extendedProps}
        providers={providers}
        onSave={handleSaveAppointment}
      />

      <ConflictErrorDialog
        open={conflictErrorOpen}
        onOpenChange={setConflictErrorOpen}
        error={mockConflictError}
      />
    </div>
  );
}
