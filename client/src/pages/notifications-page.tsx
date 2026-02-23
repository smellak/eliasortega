import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { emailRecipientsApi, emailApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  EmailRecipient,
  CreateEmailRecipientInput,
  UpdateEmailRecipientInput,
  EmailLog,
} from "@shared/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
} from "lucide-react";

interface NotificationsPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

function RecipientFormDialog({
  open,
  onOpenChange,
  recipient,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient?: EmailRecipient | null;
  onSubmit: (data: CreateEmailRecipientInput) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(recipient?.name ?? "");
  const [email, setEmail] = useState(recipient?.email ?? "");
  const [receivesDailySummary, setReceivesDailySummary] = useState(
    recipient?.receivesDailySummary ?? true,
  );
  const [receivesAlerts, setReceivesAlerts] = useState(
    recipient?.receivesAlerts ?? true,
  );
  const [receivesUrgent, setReceivesUrgent] = useState(
    recipient?.receivesUrgent ?? true,
  );
  const [active, setActive] = useState(recipient?.active ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      email,
      receivesDailySummary,
      receivesAlerts,
      receivesUrgent,
      active,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-recipient-form">
        <DialogHeader>
          <DialogTitle>
            {recipient ? "Editar destinatario" : "Añadir destinatario"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient-name">Nombre</Label>
            <Input
              id="recipient-name"
              data-testid="input-recipient-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient-email">Email</Label>
            <Input
              id="recipient-email"
              data-testid="input-recipient-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="receives-daily"
                data-testid="checkbox-receives-daily"
                checked={receivesDailySummary}
                onCheckedChange={(v) => setReceivesDailySummary(!!v)}
              />
              <Label htmlFor="receives-daily">Resumen diario</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="receives-alerts"
                data-testid="checkbox-receives-alerts"
                checked={receivesAlerts}
                onCheckedChange={(v) => setReceivesAlerts(!!v)}
              />
              <Label htmlFor="receives-alerts">Alertas</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="receives-urgent"
                data-testid="checkbox-receives-urgent"
                checked={receivesUrgent}
                onCheckedChange={(v) => setReceivesUrgent(!!v)}
              />
              <Label htmlFor="receives-urgent">Urgentes</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="recipient-active"
                data-testid="checkbox-recipient-active"
                checked={active}
                onCheckedChange={(v) => setActive(!!v)}
              />
              <Label htmlFor="recipient-active">Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-recipient-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !name || !email}
              data-testid="button-recipient-submit"
            >
              {recipient ? "Guardar" : "Añadir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecipientsTab({ readOnly }: { readOnly: boolean }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] =
    useState<EmailRecipient | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recipientToDelete, setRecipientToDelete] = useState<string | null>(
    null,
  );

  const {
    data: recipients = [],
    isLoading,
    error,
  } = useQuery<EmailRecipient[]>({
    queryKey: ["/api/email-recipients"],
    queryFn: () => emailRecipientsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateEmailRecipientInput) =>
      emailRecipientsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-recipients"] });
      setDialogOpen(false);
      toast({ title: "Destinatario creado correctamente" });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateEmailRecipientInput;
    }) => emailRecipientsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-recipients"] });
      setDialogOpen(false);
      setEditingRecipient(null);
      toast({ title: "Destinatario actualizado correctamente" });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailRecipientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-recipients"] });
      toast({ title: "Destinatario eliminado correctamente" });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenAdd = () => {
    setEditingRecipient(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (r: EmailRecipient) => {
    setEditingRecipient(r);
    setDialogOpen(true);
  };

  const handleSubmit = (data: CreateEmailRecipientInput) => {
    if (editingRecipient) {
      updateMutation.mutate({ id: editingRecipient.id, input: data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDeleteClick = (id: string) => {
    setRecipientToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (recipientToDelete) {
      deleteMutation.mutate(recipientToDelete);
      setDeleteConfirmOpen(false);
      setRecipientToDelete(null);
    }
  };

  if (isLoading) {
    return (
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
    );
  }

  if (error) {
    return (
      <Card className="p-8 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <div className="text-destructive font-medium">
            Error al cargar los destinatarios
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleOpenAdd} data-testid="button-add-recipient">
            <Plus className="mr-2 h-4 w-4" />
            Añadir destinatario
          </Button>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Resumen diario</TableHead>
              <TableHead>Alertas</TableHead>
              <TableHead>Urgentes</TableHead>
              <TableHead>Activo</TableHead>
              {!readOnly && <TableHead>Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={readOnly ? 6 : 7}
                  className="text-center text-muted-foreground py-8"
                >
                  No hay destinatarios configurados
                </TableCell>
              </TableRow>
            ) : (
              recipients.map((r) => (
                <TableRow key={r.id} data-testid={`row-recipient-${r.id}`}>
                  <TableCell data-testid={`text-recipient-name-${r.id}`}>
                    {r.name}
                  </TableCell>
                  <TableCell data-testid={`text-recipient-email-${r.id}`}>
                    {r.email}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={r.receivesDailySummary}
                      disabled={readOnly}
                      data-testid={`switch-daily-${r.id}`}
                      onCheckedChange={(v) =>
                        updateMutation.mutate({
                          id: r.id,
                          input: { receivesDailySummary: v },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={r.receivesAlerts}
                      disabled={readOnly}
                      data-testid={`switch-alerts-${r.id}`}
                      onCheckedChange={(v) =>
                        updateMutation.mutate({
                          id: r.id,
                          input: { receivesAlerts: v },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={r.receivesUrgent}
                      disabled={readOnly}
                      data-testid={`switch-urgent-${r.id}`}
                      onCheckedChange={(v) =>
                        updateMutation.mutate({
                          id: r.id,
                          input: { receivesUrgent: v },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={r.active}
                      disabled={readOnly}
                      data-testid={`switch-active-${r.id}`}
                      onCheckedChange={(v) =>
                        updateMutation.mutate({
                          id: r.id,
                          input: { active: v },
                        })
                      }
                    />
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(r)}
                          data-testid={`button-edit-recipient-${r.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteClick(r.id)}
                          data-testid={`button-delete-recipient-${r.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {dialogOpen && (
        <RecipientFormDialog
          key={editingRecipient?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={(v) => {
            setDialogOpen(v);
            if (!v) setEditingRecipient(null);
          }}
          recipient={editingRecipient}
          onSubmit={handleSubmit}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar destinatario"
        description="¿Estás seguro de que quieres eliminar este destinatario? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function EmailLogTab() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useQuery<{
    logs: EmailLog[];
    total: number;
  }>({
    queryKey: ["/api/email-log", page],
    queryFn: () => emailApi.getLog({ page, limit }),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (isLoading) {
    return (
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
    );
  }

  if (error) {
    return (
      <Card className="p-8 border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <div className="text-destructive font-medium">
            Error al cargar el historial de correos
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Destinatario</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Asunto</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  No hay registros de correos
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} data-testid={`row-email-log-${log.id}`}>
                  <TableCell data-testid={`text-log-date-${log.id}`}>
                    {log.sentAt
                      ? new Date(log.sentAt).toLocaleString("es-ES")
                      : new Date(log.createdAt).toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell data-testid={`text-log-recipient-${log.id}`}>
                    {log.recipientEmail}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      data-testid={`badge-log-type-${log.id}`}
                    >
                      {log.type === "DAILY_SUMMARY"
                        ? "Resumen diario"
                        : "Alerta"}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-log-subject-${log.id}`}>
                    {log.subject}
                  </TableCell>
                  <TableCell>
                    {log.status === "SENT" ? (
                      <Badge
                        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        data-testid={`badge-log-status-${log.id}`}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Enviado
                      </Badge>
                    ) : (
                      <Badge
                        className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        data-testid={`badge-log-status-${log.id}`}
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Fallido
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="icon"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            data-testid="button-log-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span
            className="text-sm text-muted-foreground"
            data-testid="text-log-page-info"
          >
            Página {page} de {totalPages}
          </span>
          <Button
            size="icon"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            data-testid="button-log-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");

  const sendTestMutation = useMutation({
    mutationFn: (to: string) => emailApi.sendTest(to),
    onSuccess: () => {
      toast({ title: "Correo de prueba enviado correctamente" });
      setTestEmail("");
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (testEmail) {
      sendTestMutation.mutate(testEmail);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium" data-testid="text-schedule-title">
              Resumen diario programado
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              El resumen diario se envía automáticamente todos los días a las{" "}
              <strong>7:00</strong> (hora de Madrid) a todos los destinatarios
              que tengan activada la opción de resumen diario.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <Info className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-medium" data-testid="text-smtp-title">
              Configuración SMTP
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              El servidor de correo se configura mediante variables de entorno
              (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS). Envía un correo de
              prueba para verificar que la configuración es correcta.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Send className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium" data-testid="text-test-email-title">
              Enviar correo de prueba
            </h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Introduce una dirección de email para enviar un correo de prueba y
              verificar la configuración SMTP.
            </p>
            <form
              onSubmit={handleSendTest}
              className="flex items-center gap-2 flex-wrap"
            >
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="max-w-xs"
                data-testid="input-test-email"
                required
              />
              <Button
                type="submit"
                disabled={sendTestMutation.isPending || !testEmail}
                data-testid="button-send-test-email"
              >
                <Mail className="mr-2 h-4 w-4" />
                {sendTestMutation.isPending ? "Enviando..." : "Enviar prueba"}
              </Button>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function NotificationsPage({ userRole }: NotificationsPageProps) {
  const isReadOnly = userRole === "BASIC_READONLY";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="page-icon">
          <Bell />
        </div>
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">
            Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Gestión de correos y destinatarios
          </p>
        </div>
      </div>

      <Tabs defaultValue="recipients">
        <TabsList data-testid="tabs-notifications">
          <TabsTrigger value="recipients" data-testid="tab-recipients">
            Destinatarios
          </TabsTrigger>
          <TabsTrigger value="log" data-testid="tab-email-log">
            Historial de Correos
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recipients" className="mt-4">
          <RecipientsTab readOnly={isReadOnly} />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <EmailLogTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
