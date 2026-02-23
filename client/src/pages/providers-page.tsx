import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ProvidersTable } from "@/components/providers-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { providersApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Provider, CreateProviderInput, UpdateProviderInput } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Package, AlertCircle } from "lucide-react";

interface ProvidersPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

export default function ProvidersPage({ userRole }: ProvidersPageProps) {
  const { toast } = useToast();
  const isReadOnly = userRole === "BASIC_READONLY";
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);

  const { data: providers = [], isLoading, error } = useQuery<Provider[]>({
    queryKey: ["/api/providers"],
    queryFn: () => providersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateProviderInput) => providersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({
        title: "Éxito",
        description: "Proveedor creado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el proveedor",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProviderInput }) =>
      providersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({
        title: "Éxito",
        description: "Proveedor actualizado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el proveedor",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => providersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/providers"] });
      toast({
        title: "Éxito",
        description: "Proveedor eliminado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el proveedor",
        variant: "destructive",
      });
    },
  });

  const handleAdd = (provider: { name: string; notes?: string }) => {
    createMutation.mutate(provider);
  };

  const handleEdit = (id: string, provider: { name?: string; notes?: string }) => {
    updateMutation.mutate({ id, input: provider });
  };

  const handleDelete = (id: string) => {
    setProviderToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (providerToDelete) {
      deleteMutation.mutate(providerToDelete);
      setDeleteConfirmOpen(false);
      setProviderToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="page-icon">
            <Package />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Proveedores</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona los proveedores de entrega del almacén
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="space-y-3">
                <div className="h-5 rounded w-1/3 skeleton-shimmer" />
                <div className="h-4 rounded w-2/3 skeleton-shimmer" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="page-icon">
            <Package />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Proveedores</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona los proveedores de entrega del almacén
            </p>
          </div>
        </div>
        <Card className="p-8 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-destructive font-medium">
              Error al cargar los proveedores
            </div>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="page-icon">
          <Package />
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los proveedores de entrega del almacén
          </p>
        </div>
      </div>

      <ProvidersTable
        providers={providers}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        readOnly={isReadOnly}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar proveedor"
        description="¿Estás seguro de que quieres eliminar este proveedor? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
