import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ResponsiveTable } from "@/components/responsive-table";
import { emailRecipientsApi, emailApi, providerEmailConfigApi } from "@/lib/api";
import type { ProviderEmailConfig } from "@/lib/api";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Mail,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  FileText,
  Eye,
} from "lucide-react";

interface NotificationsPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

// ── Recipient Form Dialog ──

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
              <Label htmlFor="receives-alerts">Alertas de citas</Label>
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

// ── Tab: Proveedores ──

function ProvidersTab() {
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState("");
  const [previewType, setPreviewType] = useState("confirmation");
  const [iframeKey, setIframeKey] = useState(0);

  const { data: config, isLoading } = useQuery<ProviderEmailConfig>({
    queryKey: ["provider-email-config"],
    queryFn: providerEmailConfigApi.get,
  });

  const [confirmationEnabled, setConfirmationEnabled] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [extraText, setExtraText] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [loaded, setLoaded] = useState(false);

  if (config && !loaded) {
    setConfirmationEnabled(config.confirmation_email_enabled !== "false");
    setReminderEnabled(config.reminder_email_enabled !== "false");
    setExtraText(config.provider_email_extra_text || "");
    setContactPhone(config.provider_email_contact_phone || "");
    setLoaded(true);
  }

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ProviderEmailConfig>) =>
      providerEmailConfigApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-email-config"] });
      toast({ title: "Configuración guardada" });
      setIframeKey((k) => k + 1);
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: ({ to, type }: { to: string; type: string }) =>
      emailApi.sendTestConfirmation(to, type),
    onSuccess: (data) => {
      toast({ title: data.message || "Email de prueba enviado" });
      queryClient.invalidateQueries({ queryKey: ["/api/email-log"] });
    },
    onError: (err: Error) => {
      toast({
        title: "Error al enviar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      confirmation_email_enabled: confirmationEnabled ? "true" : "false",
      reminder_email_enabled: reminderEnabled ? "true" : "false",
      provider_email_extra_text: extraText,
      provider_email_contact_phone: contactPhone,
    });
  };

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (testEmail) {
      sendTestMutation.mutate({ to: testEmail, type: previewType });
    }
  };

  const previewUrl = useMemo(() => {
    const token = localStorage.getItem("authToken");
    const params = new URLSearchParams({ type: previewType });
    if (extraText) params.append("extraText", extraText);
    if (contactPhone) params.append("contactPhone", contactPhone);
    return `/api/email/preview?${params}&_token=${token}&_k=${iframeKey}`;
  }, [previewType, extraText, contactPhone, iframeKey]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-5 rounded w-1/3 skeleton-shimmer" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Config section */}
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-base">Emails a proveedores</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Confirmación de cita</p>
              <p className="text-xs text-muted-foreground">
                Se envía al reservar una cita
              </p>
            </div>
            <Switch
              checked={confirmationEnabled}
              onCheckedChange={setConfirmationEnabled}
              data-testid="switch-confirmation-enabled"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Recordatorio 48h antes</p>
              <p className="text-xs text-muted-foreground">
                Se envía automáticamente
              </p>
            </div>
            <Switch
              checked={reminderEnabled}
              onCheckedChange={setReminderEnabled}
              data-testid="switch-reminder-enabled"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="contact-phone">Teléfono del almacén</Label>
            <Input
              id="contact-phone"
              type="tel"
              placeholder="+34 958 XXX XXX"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="mt-1"
              data-testid="input-contact-phone"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se incluye en los emails
            </p>
          </div>
          <div>
            <Label htmlFor="extra-text">Texto adicional</Label>
            <Textarea
              id="extra-text"
              placeholder="Instrucciones especiales, normas del almacén..."
              value={extraText}
              onChange={(e) => setExtraText(e.target.value)}
              className="mt-1 min-h-[68px]"
              data-testid="input-extra-text"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se muestra destacado en los emails
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-provider-config"
          >
            {updateMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </Card>

      {/* Preview + Test section */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-base">
              Preview del email
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={previewType}
              onValueChange={setPreviewType}
            >
              <SelectTrigger
                className="w-[200px]"
                data-testid="select-preview-type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmation">Confirmación</SelectItem>
                <SelectItem value="reminder">Recordatorio</SelectItem>
                <SelectItem value="reminder-confirmed">
                  Recordatorio (confirmado)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Test send form */}
        <form
          onSubmit={handleSendTest}
          className="flex items-end gap-2 flex-wrap"
        >
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="test-email-addr" className="text-xs text-muted-foreground">
              Enviar prueba a:
            </Label>
            <Input
              id="test-email-addr"
              type="email"
              placeholder="email@ejemplo.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="mt-1"
              data-testid="input-test-email"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={sendTestMutation.isPending || !testEmail}
            data-testid="button-send-test-email"
            className="shrink-0"
          >
            <Send className="mr-2 h-4 w-4" />
            {sendTestMutation.isPending ? "Enviando..." : "Enviar prueba"}
          </Button>
        </form>

        {/* iframe preview */}
        <div
          className="rounded-lg border bg-white overflow-hidden"
          data-testid="email-preview-container"
        >
          <iframe
            key={iframeKey}
            src={previewUrl}
            className="w-full border-0"
            style={{ height: "520px" }}
            title="Vista previa del email"
            data-testid="email-preview-iframe"
            sandbox="allow-same-origin"
          />
        </div>
      </Card>
    </div>
  );
}

// ── Tab: Equipo ──

function TeamTab({ readOnly }: { readOnly: boolean }) {
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
      toast({ title: "Destinatario actualizado" });
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
      toast({ title: "Destinatario eliminado" });
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
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-base">Destinatarios del equipo</h3>
            <p className="text-xs text-muted-foreground">
              Reciben el resumen diario, alertas de citas y notificaciones urgentes
            </p>
          </div>
          {!readOnly && (
            <Button
              onClick={handleOpenAdd}
              size="sm"
              data-testid="button-add-recipient"
            >
              <Plus className="mr-2 h-4 w-4" />
              Añadir
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <ResponsiveTable>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Resumen</TableHead>
                <TableHead className="text-center">Alertas</TableHead>
                <TableHead className="text-center">Urgentes</TableHead>
                <TableHead className="text-center">Activo</TableHead>
                {!readOnly && <TableHead className="text-center">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 6 : 7}
                    className="text-center text-muted-foreground py-8"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 opacity-30" />
                      <p>No hay destinatarios configurados</p>
                      {!readOnly && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenAdd}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Añadir el primero
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                recipients.map((r) => (
                  <TableRow key={r.id} data-testid={`row-recipient-${r.id}`}>
                    <TableCell data-testid={`text-recipient-name-${r.id}`}>
                      <span className="font-medium">{r.name}</span>
                    </TableCell>
                    <TableCell data-testid={`text-recipient-email-${r.id}`}>
                      <span className="text-sm text-muted-foreground">
                        {r.email}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
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
                    <TableCell className="text-center">
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
                    <TableCell className="text-center">
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
                    <TableCell className="text-center">
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
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
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
        </ResponsiveTable>
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

// ── Tab: Registro ──

function LogTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
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

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (statusFilter !== "all" && log.status !== statusFilter) return false;
      if (typeFilter !== "all" && log.type !== typeFilter) return false;
      return true;
    });
  }, [logs, statusFilter, typeFilter]);

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
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-log-status-filter">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="SENT">Enviados</SelectItem>
            <SelectItem value="FAILED">Fallidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-log-type-filter">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="DAILY_SUMMARY">Resumen diario</SelectItem>
            <SelectItem value="ALERT">Alerta</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto" data-testid="text-log-total">
          {total} email{total !== 1 ? "s" : ""} en total
        </span>
      </div>

      <Card>
        <ResponsiveTable>
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
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Mail className="h-8 w-8 opacity-30" />
                      <p>No hay registros de correos</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    data-testid={`row-email-log-${log.id}`}
                  >
                    <TableCell data-testid={`text-log-date-${log.id}`}>
                      <span className="text-sm">
                        {log.sentAt
                          ? new Date(log.sentAt).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : new Date(log.createdAt).toLocaleString("es-ES", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                      </span>
                    </TableCell>
                    <TableCell data-testid={`text-log-recipient-${log.id}`}>
                      <span className="text-sm">{log.recipientEmail}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        data-testid={`badge-log-type-${log.id}`}
                      >
                        {log.type === "DAILY_SUMMARY"
                          ? "Resumen"
                          : "Alerta"}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-log-subject-${log.id}`}>
                      <span className="text-sm line-clamp-1 max-w-[250px]">
                        {log.subject}
                      </span>
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
                          title={log.error || ""}
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
        </ResponsiveTable>
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

// ── Main Page ──

export default function NotificationsPage({
  userRole,
}: NotificationsPageProps) {
  const isReadOnly = userRole === "BASIC_READONLY";

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="page-icon">
          <Bell />
        </div>
        <div>
          <h1
            className="text-3xl font-semibold"
            data-testid="text-page-title"
          >
            Notificaciones y Emails
          </h1>
          <p
            className="text-sm text-muted-foreground mt-1"
            data-testid="text-page-subtitle"
          >
            Gestiona los emails a proveedores y al equipo
          </p>
        </div>
      </div>

      <Tabs defaultValue="providers">
        <TabsList data-testid="tabs-notifications">
          <TabsTrigger value="providers" data-testid="tab-providers">
            <Mail className="mr-1.5 h-4 w-4" />
            Proveedores
          </TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">
            <Users className="mr-1.5 h-4 w-4" />
            Equipo
          </TabsTrigger>
          <TabsTrigger value="log" data-testid="tab-email-log">
            <FileText className="mr-1.5 h-4 w-4" />
            Registro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-4">
          <ProvidersTab />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <TeamTab readOnly={isReadOnly} />
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <LogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
