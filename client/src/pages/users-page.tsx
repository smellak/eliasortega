import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UsersTable } from "@/components/users-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { usersApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserResponse } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Users, AlertCircle } from "lucide-react";

export default function UsersPage() {
  const { toast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const { data: users = [], isLoading, error } = useQuery<UserResponse[]>({
    queryKey: ["/api/users"],
    queryFn: () => usersApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (input: { email: string; password: string; role: "ADMIN" | "PLANNER" | "BASIC_READONLY" }) =>
      usersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Éxito",
        description: "Usuario creado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el usuario",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { email?: string; role?: string } }) =>
      usersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Éxito",
        description: "Usuario actualizado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el usuario",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Éxito",
        description: "Usuario eliminado correctamente",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el usuario",
        variant: "destructive",
      });
    },
  });

  const handleAdd = (user: any) => {
    createMutation.mutate(user);
  };

  const handleEdit = (id: string, user: any) => {
    updateMutation.mutate({ id, input: user });
  };

  const handleDelete = (id: string) => {
    setUserToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete);
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="page-icon">
            <Users />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona las cuentas y permisos de usuarios
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="space-y-3">
                <div className="h-5 rounded w-1/4 skeleton-shimmer" />
                <div className="h-4 rounded w-1/2 skeleton-shimmer" />
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
            <Users />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Usuarios</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestiona las cuentas y permisos de usuarios
            </p>
          </div>
        </div>
        <Card className="p-8 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <div className="text-destructive font-medium">
              Error al cargar los usuarios
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
          <Users />
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona las cuentas y permisos de usuarios
          </p>
        </div>
      </div>

      <UsersTable
        users={users}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar usuario"
        description="¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
