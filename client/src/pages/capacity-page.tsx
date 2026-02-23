import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CapacityWindowsTable } from "@/components/capacity-windows-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { capacityShiftsApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CapacityShift, CreateCapacityShiftInput, UpdateCapacityShiftInput } from "@shared/types";
import { Card } from "@/components/ui/card";

interface CapacityPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

export default function CapacityPage({ userRole }: CapacityPageProps) {
  const { toast } = useToast();
  const isReadOnly = userRole === "BASIC_READONLY";
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);

  const { data: windows = [], isLoading, error } = useQuery<CapacityShift[]>({
    queryKey: ["/api/capacity-shifts"],
    queryFn: () => capacityShiftsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateCapacityShiftInput) => capacityShiftsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity-shifts"] });
      toast({
        title: "Éxito",
        description: "Turno de capacidad creado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el turno de capacidad",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCapacityShiftInput }) =>
      capacityShiftsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity-shifts"] });
      toast({
        title: "Éxito",
        description: "Turno de capacidad actualizado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el turno de capacidad",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => capacityShiftsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/capacity-shifts"] });
      toast({
        title: "Éxito",
        description: "Turno de capacidad eliminado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el turno de capacidad",
        variant: "destructive",
      });
    },
  });

  const handleAdd = (window: any) => {
    createMutation.mutate(window);
  };

  const handleEdit = (id: string, window: any) => {
    updateMutation.mutate({ id, input: window });
  };

  const handleDelete = (id: string) => {
    setShiftToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (shiftToDelete) {
      deleteMutation.mutate(shiftToDelete);
      setDeleteConfirmOpen(false);
      setShiftToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Turnos de Capacidad</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define la capacidad del almacén para diferentes periodos de tiempo
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center text-muted-foreground">Cargando turnos de capacidad...</div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Turnos de Capacidad</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define la capacidad del almacén para diferentes periodos de tiempo
          </p>
        </div>
        <Card className="p-12">
          <div className="text-center text-destructive">
            Error al cargar los turnos de capacidad: {(error as Error).message}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Turnos de Capacidad</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define la capacidad del almacén para diferentes periodos de tiempo
        </p>
      </div>

      <CapacityWindowsTable
        windows={windows}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        readOnly={isReadOnly}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar turno de capacidad"
        description="¿Estás seguro de que quieres eliminar este turno de capacidad? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
