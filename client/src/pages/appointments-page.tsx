import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { Search, Pencil, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import { appointmentsApi, providersApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Provider, CreateAppointmentInput, UpdateAppointmentInput } from "@shared/types";

interface AppointmentsPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

const TIMEZONE = "Europe/Madrid";

export default function AppointmentsPage({ userRole }: AppointmentsPageProps) {
  const { toast } = useToast();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const isReadOnly = userRole === "BASIC_READONLY";

  // Fetch appointments
  const { data: appointments = [], isLoading: isLoadingAppointments } = useQuery<Appointment[]>({
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
      setSelectedAppointment(null);
      toast({
        title: "Éxito",
        description: "Cita creada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear la cita",
        variant: "destructive",
      });
    },
  });

  // Update appointment mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAppointmentInput }) =>
      appointmentsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setAppointmentDialogOpen(false);
      setSelectedAppointment(null);
      toast({
        title: "Éxito",
        description: "Cita actualizada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la cita",
        variant: "destructive",
      });
    },
  });

  // Delete appointment mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Éxito",
        description: "Cita eliminada correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la cita",
        variant: "destructive",
      });
    },
  });

  const filteredAppointments = appointments.filter(apt =>
    apt.providerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setAppointmentDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar esta cita?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSave = (data: any) => {
    if (selectedAppointment) {
      updateMutation.mutate({ id: selectedAppointment.id, input: data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoadingAppointments) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Citas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualiza y gestiona todas las citas del almacén
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center text-muted-foreground">Cargando citas...</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Citas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualiza y gestiona todas las citas del almacén
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => {
            setSelectedAppointment(null);
            setAppointmentDialogOpen(true);
          }} data-testid="button-new-appointment">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Cita
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por proveedor..."
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
                  <div>Trabajo: {appointment.workMinutesNeeded} min</div>
                  <div>Carretillas: {appointment.forkliftsNeeded}</div>
                  {appointment.units !== null && <div>Unidades: {appointment.units}</div>}
                  {appointment.lines !== null && <div>Líneas: {appointment.lines}</div>}
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
              <p>No se encontraron citas.</p>
              {searchQuery && <p className="text-sm mt-1">Intenta con otro término de búsqueda.</p>}
            </div>
          </Card>
        )}
      </div>

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        appointment={selectedAppointment as any}
        providers={providers}
        onSave={handleSave}
      />
    </div>
  );
}
