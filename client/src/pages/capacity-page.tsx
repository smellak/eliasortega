import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { slotTemplatesApi, slotOverridesApi } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  SlotTemplate,
  CreateSlotTemplateInput,
  SlotOverride,
  CreateSlotOverrideInput,
} from "@shared/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Gauge, AlertCircle, Plus, Trash2 } from "lucide-react";

interface CapacityPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

const WEEKDAY_DAYS = [
  { name: "Lun", idx: 1 },
  { name: "Mar", idx: 2 },
  { name: "Mié", idx: 3 },
  { name: "Jue", idx: 4 },
  { name: "Vie", idx: 5 },
];
const SATURDAY_DAYS = [{ name: "Sáb", idx: 6 }];
const SUNDAY_DAYS = [{ name: "Dom", idx: 0 }];
const ALL_DAY_INDICES = [1, 2, 3, 4, 5, 6, 0];

function PageHeader() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="page-icon">
        <Gauge />
      </div>
      <div>
        <h1 className="text-3xl font-semibold">Gestión de Franjas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define plantillas semanales de franjas y excepciones por fecha
        </p>
      </div>
    </div>
  );
}

function SlotTemplatesTab({ isReadOnly }: { isReadOnly: boolean }) {
  const { toast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStartTime, setNewStartTime] = useState("08:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newMaxPoints, setNewMaxPoints] = useState(6);

  const { data: templates = [], isLoading } = useQuery<SlotTemplate[]>({
    queryKey: ["/api/slot-templates"],
    queryFn: () => slotTemplatesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSlotTemplateInput) => slotTemplatesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slot-templates"] });
      toast({ title: "Éxito", description: "Plantilla creada correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al crear la plantilla", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { maxPoints?: number; active?: boolean } }) =>
      slotTemplatesApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slot-templates"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al actualizar", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => slotTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slot-templates"] });
      toast({ title: "Éxito", description: "Plantilla eliminada correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al eliminar", variant: "destructive" });
    },
  });

  const weekdayTimeSlots = Array.from(
    new Set(
      templates
        .filter((t) => t.dayOfWeek >= 1 && t.dayOfWeek <= 5)
        .map((t) => `${t.startTime}-${t.endTime}`)
    )
  ).sort();

  const saturdayTimeSlots = Array.from(
    new Set(
      templates
        .filter((t) => t.dayOfWeek === 6)
        .map((t) => `${t.startTime}-${t.endTime}`)
    )
  ).sort();

  const sundayTimeSlots = Array.from(
    new Set(
      templates
        .filter((t) => t.dayOfWeek === 0)
        .map((t) => `${t.startTime}-${t.endTime}`)
    )
  ).sort();

  const allTimeSlots = Array.from(
    new Set(templates.map((t) => `${t.startTime}-${t.endTime}`))
  ).sort();

  const getTemplate = (timeKey: string, dayOfWeek: number) => {
    const [startTime, endTime] = timeKey.split("-");
    return templates.find(
      (t) => t.startTime === startTime && t.endTime === endTime && t.dayOfWeek === dayOfWeek
    );
  };

  const handleMaxPointsChange = (templateId: string, value: string) => {
    const maxPoints = parseInt(value, 10);
    if (!isNaN(maxPoints) && maxPoints >= 0) {
      updateMutation.mutate({ id: templateId, input: { maxPoints } });
    }
  };

  const handleToggleActive = (templateId: string, active: boolean) => {
    updateMutation.mutate({ id: templateId, input: { active } });
  };

  const handleAddTemplates = () => {
    ALL_DAY_INDICES.forEach((day) => {
      createMutation.mutate({
        dayOfWeek: day,
        startTime: newStartTime,
        endTime: newEndTime,
        maxPoints: newMaxPoints,
        active: true,
      });
    });
    setAddDialogOpen(false);
    setNewStartTime("08:00");
    setNewEndTime("10:00");
    setNewMaxPoints(6);
  };

  const handleDeleteTimeSlot = (timeKey: string) => {
    const [startTime, endTime] = timeKey.split("-");
    const toDelete = templates.filter(
      (t) => t.startTime === startTime && t.endTime === endTime
    );
    toDelete.forEach((t) => deleteMutation.mutate(t.id));
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      handleDeleteTimeSlot(templateToDelete);
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    }
  };

  const renderSlotGrid = (
    title: string,
    days: { name: string; idx: number }[],
    timeSlots: string[],
  ) => (
    <div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <Card className="overflow-x-auto">
        <Table data-testid={`table-slot-templates-${title.toLowerCase().replace(/\s+/g, "-")}`}>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Franja</TableHead>
              {days.map((day) => (
                <TableHead key={day.idx} className="text-center min-w-[90px]" data-testid={`header-day-${day.idx}`}>
                  {day.name}
                </TableHead>
              ))}
              {!isReadOnly && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeSlots.map((timeKey) => {
              const [startTime, endTime] = timeKey.split("-");
              return (
                <TableRow key={timeKey} data-testid={`row-template-${timeKey}`}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {startTime} - {endTime}
                  </TableCell>
                  {days.map((day) => {
                    const template = getTemplate(timeKey, day.idx);
                    return (
                      <TableCell key={day.idx} className="text-center">
                        {template ? (
                          <div className="flex flex-col items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              value={template.maxPoints}
                              onChange={(e) => handleMaxPointsChange(template.id, e.target.value)}
                              disabled={isReadOnly}
                              className="w-16 text-center"
                              data-testid={`input-maxpoints-${template.id}`}
                            />
                            <Switch
                              checked={template.active}
                              onCheckedChange={(checked) => handleToggleActive(template.id, checked)}
                              disabled={isReadOnly}
                              data-testid={`switch-active-${template.id}`}
                            />
                          </div>
                        ) : null}
                      </TableCell>
                    );
                  })}
                  {!isReadOnly && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setTemplateToDelete(timeKey);
                          setDeleteConfirmOpen(true);
                        }}
                        data-testid={`button-delete-template-${timeKey}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );

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

  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <div className="flex justify-end">
          <Button
            onClick={() => setAddDialogOpen(true)}
            data-testid="button-add-template"
          >
            <Plus className="mr-2 h-4 w-4" />
            Añadir Franja
          </Button>
        </div>
      )}

      {allTimeSlots.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-muted-foreground">No hay plantillas de franja definidas.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {weekdayTimeSlots.length > 0 && renderSlotGrid("Lunes a Viernes", WEEKDAY_DAYS, weekdayTimeSlots)}
          {saturdayTimeSlots.length > 0 && renderSlotGrid("Sábado", SATURDAY_DAYS, saturdayTimeSlots)}
          {sundayTimeSlots.length > 0 && renderSlotGrid("Domingo", SUNDAY_DAYS, sundayTimeSlots)}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-template">
          <DialogHeader>
            <DialogTitle>Añadir Franja Horaria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Hora inicio</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  data-testid="input-new-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Hora fin</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  data-testid="input-new-end-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPoints">Puntos máximos (por defecto)</Label>
              <Input
                id="maxPoints"
                type="number"
                min={0}
                value={newMaxPoints}
                onChange={(e) => setNewMaxPoints(parseInt(e.target.value, 10) || 0)}
                data-testid="input-new-max-points"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Se creará una plantilla para cada día (Lun-Dom) con estos valores.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} data-testid="button-cancel-add-template">
              Cancelar
            </Button>
            <Button
              onClick={handleAddTemplates}
              disabled={createMutation.isPending}
              data-testid="button-confirm-add-template"
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar franja horaria"
        description="¿Estás seguro de que quieres eliminar esta franja horaria de todos los días? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function SlotOverridesTab({ isReadOnly }: { isReadOnly: boolean }) {
  const { toast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [overrideToDelete, setOverrideToDelete] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newDateEnd, setNewDateEnd] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newMaxPoints, setNewMaxPoints] = useState(0);
  const [newReason, setNewReason] = useState("");

  const { data: overrides = [], isLoading } = useQuery<SlotOverride[]>({
    queryKey: ["/api/slot-overrides"],
    queryFn: () => slotOverridesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateSlotOverrideInput) => slotOverridesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slot-overrides"] });
      toast({ title: "Éxito", description: "Excepción creada correctamente" });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al crear la excepción", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => slotOverridesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/slot-overrides"] });
      toast({ title: "Éxito", description: "Excepción eliminada correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Error al eliminar", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNewDate("");
    setNewDateEnd("");
    setNewStartTime("");
    setNewEndTime("");
    setNewMaxPoints(0);
    setNewReason("");
  };

  const handleAdd = () => {
    if (!newDate) {
      toast({ title: "Error", description: "La fecha es obligatoria", variant: "destructive" });
      return;
    }
    if (newDateEnd && newDateEnd < newDate) {
      toast({ title: "Error", description: "La fecha fin debe ser igual o posterior a la fecha inicio", variant: "destructive" });
      return;
    }
    const dateValue = new Date(newDate);
    dateValue.setUTCHours(0, 0, 0, 0);

    let dateEndValue: string | undefined;
    if (newDateEnd) {
      const de = new Date(newDateEnd);
      de.setUTCHours(0, 0, 0, 0);
      dateEndValue = de.toISOString();
    }

    createMutation.mutate({
      date: dateValue.toISOString(),
      dateEnd: dateEndValue,
      startTime: newStartTime || undefined,
      endTime: newEndTime || undefined,
      maxPoints: newMaxPoints,
      reason: newReason || undefined,
    });
  };

  const confirmDelete = () => {
    if (overrideToDelete) {
      deleteMutation.mutate(overrideToDelete);
      setDeleteConfirmOpen(false);
      setOverrideToDelete(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
  };

  const formatDateRange = (override: SlotOverride) => {
    const start = formatDate(override.date);
    if (override.dateEnd) {
      const end = formatDate(override.dateEnd);
      return `${start} — ${end}`;
    }
    return start;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
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

  return (
    <div className="space-y-4">
      {!isReadOnly && (
        <div className="flex justify-end">
          <Button
            onClick={() => setAddDialogOpen(true)}
            data-testid="button-add-override"
          >
            <Plus className="mr-2 h-4 w-4" />
            Añadir Excepción
          </Button>
        </div>
      )}

      {overrides.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-muted-foreground">No hay excepciones definidas.</p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table data-testid="table-slot-overrides">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Hora inicio</TableHead>
                <TableHead>Hora fin</TableHead>
                <TableHead className="text-center">Max Puntos</TableHead>
                <TableHead>Motivo</TableHead>
                {!isReadOnly && <TableHead className="w-[60px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((override) => (
                <TableRow key={override.id} data-testid={`row-override-${override.id}`}>
                  <TableCell className="whitespace-nowrap" data-testid={`text-override-date-${override.id}`}>
                    {formatDateRange(override)}
                  </TableCell>
                  <TableCell data-testid={`text-override-start-${override.id}`}>
                    {override.startTime || "—"}
                  </TableCell>
                  <TableCell data-testid={`text-override-end-${override.id}`}>
                    {override.endTime || "—"}
                  </TableCell>
                  <TableCell className="text-center" data-testid={`text-override-points-${override.id}`}>
                    {override.maxPoints}
                  </TableCell>
                  <TableCell data-testid={`text-override-reason-${override.id}`}>
                    {override.reason || "—"}
                  </TableCell>
                  {!isReadOnly && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setOverrideToDelete(override.id);
                          setDeleteConfirmOpen(true);
                        }}
                        data-testid={`button-delete-override-${override.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent data-testid="dialog-add-override">
          <DialogHeader>
            <DialogTitle>Añadir Excepción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overrideDate">Fecha inicio</Label>
                <Input
                  id="overrideDate"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  data-testid="input-override-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overrideDateEnd">Fecha fin (opcional)</Label>
                <Input
                  id="overrideDateEnd"
                  type="date"
                  value={newDateEnd}
                  min={newDate || undefined}
                  onChange={(e) => setNewDateEnd(e.target.value)}
                  data-testid="input-override-date-end"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overrideStartTime">Hora inicio (opcional)</Label>
                <Input
                  id="overrideStartTime"
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  data-testid="input-override-start-time"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overrideEndTime">Hora fin (opcional)</Label>
                <Input
                  id="overrideEndTime"
                  type="time"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  data-testid="input-override-end-time"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overrideMaxPoints">Puntos máximos</Label>
              <Input
                id="overrideMaxPoints"
                type="number"
                min={0}
                value={newMaxPoints}
                onChange={(e) => setNewMaxPoints(parseInt(e.target.value, 10) || 0)}
                data-testid="input-override-max-points"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="overrideReason">Motivo (opcional)</Label>
              <Input
                id="overrideReason"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Ej: Festivo, inventario..."
                data-testid="input-override-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }} data-testid="button-cancel-add-override">
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              data-testid="button-confirm-add-override"
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Eliminar excepción"
        description="¿Estás seguro de que quieres eliminar esta excepción? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default function CapacityPage({ userRole }: CapacityPageProps) {
  const isReadOnly = userRole === "BASIC_READONLY";

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader />

      <Tabs defaultValue="templates" data-testid="tabs-capacity">
        <TabsList data-testid="tabs-list-capacity">
          <TabsTrigger value="templates" data-testid="tab-templates">
            Plantillas de Franja
          </TabsTrigger>
          <TabsTrigger value="overrides" data-testid="tab-overrides">
            Excepciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <SlotTemplatesTab isReadOnly={isReadOnly} />
        </TabsContent>

        <TabsContent value="overrides" className="mt-4">
          <SlotOverridesTab isReadOnly={isReadOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
