import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UsersTable } from "@/components/users-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { usersApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserResponse } from "@shared/types";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, AlertCircle, ChevronDown, Shield, Eye, Settings } from "lucide-react";

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

      <RolesLegend />

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

// ─── Roles Legend ─────────────────────────────────────────────

const ROLES = [
  {
    key: "ADMIN",
    label: "Administrador",
    icon: Shield,
    color: "border-red-300 dark:border-red-700",
    iconBg: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    can: [
      "Crear, editar y eliminar citas",
      "Gestionar proveedores y contactos",
      "Configurar capacidad, muelles y reglas de programacion",
      "Gestionar usuarios y roles",
      "Configurar emails y notificaciones",
      "Ver auditoria y precision IA",
      "Check-in y check-out de descargas",
      "Hablar con Elias (asistente IA)",
    ],
    cannot: [] as string[],
  },
  {
    key: "PLANNER",
    label: "Planificador",
    icon: Settings,
    color: "border-yellow-300 dark:border-yellow-700",
    iconBg: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    can: [
      "Crear, editar y eliminar citas",
      "Gestionar proveedores y contactos",
      "Configurar capacidad y muelles",
      "Ver auditoria y precision IA",
      "Check-in y check-out de descargas",
      "Hablar con Elias (asistente IA)",
    ],
    cannot: ["Gestionar usuarios", "Configurar emails"],
  },
  {
    key: "BASIC_READONLY",
    label: "Solo lectura",
    icon: Eye,
    color: "border-green-300 dark:border-green-700",
    iconBg: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    can: [
      "Ver calendario, citas y proveedores",
      "Ver estado del almacen",
    ],
    cannot: ["Crear o editar citas", "Gestionar configuracion", "Ver auditoria"],
  },
];

function RolesLegend() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3 text-left hover:bg-accent/50 transition-colors">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Roles y permisos</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-3 pt-3 sm:grid-cols-3">
          {ROLES.map((role) => (
            <Card key={role.key} className={`border-l-4 ${role.color} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded-md ${role.iconBg}`}>
                  <role.icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">{role.label}</h3>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {role.can.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="text-green-600 dark:text-green-400 mt-px shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
                {role.cannot.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <span className="text-red-500 dark:text-red-400 mt-px shrink-0">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3 px-1">
          Cada usuario accede al panel con su email y contrasena. Los proveedores no necesitan cuenta — usan el chat publico.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
