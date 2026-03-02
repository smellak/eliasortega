import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppointmentDialog } from "@/components/appointment-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Search, Pencil, Trash2, Plus, List, CalendarDays, Check, X, HelpCircle } from "lucide-react";
import { PageHero } from '@/components/page-hero';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatInTimeZone } from "date-fns-tz";
import { appointmentsApi, providersApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, Provider, CreateAppointmentInput, UpdateAppointmentInput } from "@shared/types";
import { AppointmentsSkeleton } from "@/components/skeleton-loaders";
import { EmptyState } from "@/components/empty-state";

interface AppointmentsPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

const TIMEZONE = "Europe/Madrid";

export default function AppointmentsPage({ userRole }: AppointmentsPageProps) {
  const { toast } = useToast();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);

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
    setAppointmentToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (appointmentToDelete) {
      deleteMutation.mutate(appointmentToDelete);
      setDeleteConfirmOpen(false);
      setAppointmentToDelete(null);
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
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="page-icon">
            <List />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Citas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visualiza y gestiona todas las citas del almacén
            </p>
          </div>
        </div>
        <AppointmentsSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={List}
        title="Citas"
        subtitle="Visualiza y gestiona todas las citas del almacén"
        actions={
          <>
            {!isReadOnly && (
              <Button className="gradient-btn text-white border-0 no-default-hover-elevate no-default-active-elevate" onClick={() => {
                setSelectedAppointment(null);
                setAppointmentDialogOpen(true);
              }} data-testid="button-new-appointment">
                <Plus className="h-4 w-4 mr-2" />
                Nueva Cita
              </Button>
            )}
          </>
        }
      />

      <div className="relative group rounded-xl shadow-sm border-2 border-transparent focus-within:border-blue-300 dark:focus-within:border-blue-700 transition-all duration-200">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
        <Input
          placeholder="Buscar por proveedor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-0 shadow-none focus-visible:ring-0 rounded-xl"
          data-testid="input-search"
        />
      </div>

      <div className="space-y-3">
        {filteredAppointments.map((appointment) => (
          <Card key={appointment.id} className={`p-4 hover-elevate border-l-4 rounded-xl transition-all duration-200 ${
            appointment.confirmationStatus === "cancelled" ? "border-l-red-400 opacity-70" :
            appointment.confirmationStatus === "confirmed" ? "border-l-green-500" :
            "border-l-blue-500"
          }`} data-testid={`card-appointment-${appointment.id}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className={`font-semibold text-lg flex items-center gap-1.5 ${appointment.confirmationStatus === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                    {appointment.confirmationStatus === "confirmed" && <Check className="h-4 w-4 text-green-600 shrink-0" />}
                    {appointment.confirmationStatus === "cancelled" && <X className="h-4 w-4 text-red-500 shrink-0" />}
                    {appointment.providerName}
                  </h3>
                  {appointment.goodsType && (
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-0">{appointment.goodsType}</Badge>
                  )}
                  {appointment.size && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className={`text-xs cursor-help ${
                          appointment.size === "S" ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                          appointment.size === "M" ? "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-300" :
                          "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}>
                          {appointment.size}{appointment.pointsUsed ? ` · ${appointment.pointsUsed} pts` : ""}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">S = pequeña (1pt, &lt;30min), M = mediana (2pt, 30-120min), L = grande (3pt, &gt;120min)</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <Badge variant="outline" className={`text-xs ${
                    appointment.confirmationStatus === "confirmed" ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400" :
                    appointment.confirmationStatus === "cancelled" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                  }`}>
                    {appointment.confirmationStatus === "confirmed" ? "Confirmada" :
                     appointment.confirmationStatus === "cancelled" ? "Cancelada" : "Pendiente"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5 font-mono">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatInTimeZone(new Date(appointment.startUtc), TIMEZONE, "MMM dd, HH:mm")} -{" "}
                    {formatInTimeZone(new Date(appointment.endUtc), TIMEZONE, "HH:mm")}
                  </div>
                  <div>Trabajo: {appointment.workMinutesNeeded} min</div>
                  <div>Carretillas: {appointment.forkliftsNeeded}</div>
                  {appointment.units !== null && <div>Unidades: {appointment.units}</div>}
                  {appointment.lines !== null && <div>Líneas: {appointment.lines}</div>}
                  {appointment.dockCode && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-mono">
                        {appointment.dockCode}
                      </span>
                      {appointment.dockName && <span className="text-xs">{appointment.dockName}</span>}
                    </div>
                  )}
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
          <EmptyState
            icon={List}
            title="No se encontraron citas"
            description={searchQuery ? "Intenta con otro término de búsqueda." : "Aún no hay citas programadas."}
            actionLabel={!isReadOnly && !searchQuery ? "Nueva Cita" : undefined}
            onAction={!isReadOnly && !searchQuery ? () => { setSelectedAppointment(null); setAppointmentDialogOpen(true); } : undefined}
          />
        )}
      </div>

      <AppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        appointment={selectedAppointment as any}
        providers={providers}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar cita"
        description="¿Estás seguro de que quieres eliminar esta cita? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
