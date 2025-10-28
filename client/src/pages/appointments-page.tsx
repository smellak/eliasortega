import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { Search, Pencil, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

interface AppointmentsPageProps {
  userRole: "admin" | "planner" | "basic_readonly";
}

export default function AppointmentsPage({ userRole }: AppointmentsPageProps) {
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isReadOnly = userRole === "basic_readonly";

  // TODO: remove mock data
  const appointments = [
    {
      id: '1',
      providerName: 'Acme Corp',
      startUtc: '2025-10-28T09:00:00Z',
      endUtc: '2025-10-28T11:00:00Z',
      workMinutesNeeded: 90,
      forkliftsNeeded: 2,
      goodsType: 'Electronics',
      units: 150,
      lines: 12,
    },
    {
      id: '2',
      providerName: 'Global Logistics',
      startUtc: '2025-10-28T14:00:00Z',
      endUtc: '2025-10-28T15:30:00Z',
      workMinutesNeeded: 60,
      forkliftsNeeded: 1,
      goodsType: 'Furniture',
      units: 50,
    },
    {
      id: '3',
      providerName: 'Fast Shipping Inc',
      startUtc: '2025-10-29T10:00:00Z',
      endUtc: '2025-10-29T12:00:00Z',
      workMinutesNeeded: 120,
      forkliftsNeeded: 2,
      units: 200,
      lines: 8,
    },
  ];

  const providers = [
    { id: '1', name: 'Acme Corp' },
    { id: '2', name: 'Global Logistics' },
    { id: '3', name: 'Fast Shipping Inc' },
  ];

  const filteredAppointments = appointments.filter(apt =>
    apt.providerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (appointment: any) => {
    setSelectedAppointment(appointment);
    setAppointmentDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    console.log("Delete appointment:", id);
    // TODO: Call API
  };

  const handleSave = (data: any) => {
    console.log("Save appointment:", data);
    // TODO: Call API
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage all warehouse appointments
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => {
            setSelectedAppointment(null);
            setAppointmentDialogOpen(true);
          }} data-testid="button-new-appointment">
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by provider..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      <div className="space-y-3">
        {filteredAppointments.map((appointment) => (
          <Card key={appointment.id} className="p-4 hover-elevate" data-testid={`card-appointment-${appointment.id}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg">{appointment.providerName}</h3>
                  {appointment.goodsType && (
                    <Badge variant="outline">{appointment.goodsType}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="font-mono">
                    {format(new Date(appointment.startUtc), "MMM dd, HH:mm")} -{" "}
                    {format(new Date(appointment.endUtc), "HH:mm")}
                  </div>
                  <div>Work: {appointment.workMinutesNeeded} min</div>
                  <div>Forklifts: {appointment.forkliftsNeeded}</div>
                  {appointment.units && <div>Units: {appointment.units}</div>}
                  {appointment.lines && <div>Lines: {appointment.lines}</div>}
                </div>
              </div>
              {!isReadOnly && (
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEdit(appointment)}
                    data-testid={`button-edit-${appointment.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(appointment.id)}
                    data-testid={`button-delete-${appointment.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {filteredAppointments.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <p>No appointments found.</p>
              {searchQuery && <p className="text-sm mt-1">Try a different search term.</p>}
            </div>
          </Card>
        )}
      </div>

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        appointment={selectedAppointment}
        providers={providers}
        onSave={handleSave}
      />
    </div>
  );
}
