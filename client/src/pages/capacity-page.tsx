import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ResponsiveTable } from "@/components/responsive-table";
import { slotTemplatesApi, slotOverridesApi, docksApi, dockOverridesApi } from "@/lib/api";
import type { DockWithAvailabilities, DockOverrideResponse } from "@/lib/api";
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
import { Badge } from "@/components/ui/badge";
import { Gauge, Plus, Trash2, Info, ChevronDown, Check, X, Warehouse } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

function PointsLegend() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Leyenda del sistema de puntos</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4 text-sm border-t pt-4">
            <div>
              <h4 className="font-semibold mb-2">Tallas de cita</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs">S</Badge>
                  <span className="text-muted-foreground">Pequeña — hasta 30 min — <strong>1 punto</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 text-xs">M</Badge>
                  <span className="text-muted-foreground">Mediana — 31 a 90 min — <strong>2 puntos</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 text-xs">L</Badge>
                  <span className="text-muted-foreground">Grande — más de 90 min — <strong>3 puntos</strong></span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Colores de ocupación</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
                  <span className="text-muted-foreground">Libre — menos del 50% ocupado</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-yellow-500 shrink-0" />
                  <span className="text-muted-foreground">Moderado — 50% a 79% ocupado</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  <span className="text-muted-foreground">Casi lleno — 80% a 99% ocupado</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-gray-500 shrink-0" />
                  <span className="text-muted-foreground">Completo — 100% ocupado</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Ejemplo</h4>
              <p className="text-muted-foreground">
                Una franja con 6 puntos máximos puede admitir, por ejemplo: 6 citas S (6×1pt), 3 citas M (3×2pt),
                2 citas L (2×3pt), o combinaciones como 2 S + 2 M (2+4=6pt).
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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
      <Card>
        <ResponsiveTable><Table data-testid={`table-slot-templates-${title.toLowerCase().replace(/\s+/g, "-")}`}>
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
        </Table></ResponsiveTable>
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

      <PointsLegend />

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
        <Card>
          <ResponsiveTable><Table data-testid="table-slot-overrides">
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
          </Table></ResponsiveTable>
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

const DOCK_WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function DockAvailabilityTab({ isReadOnly }: { isReadOnly: boolean }) {
  const { toast } = useToast();
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ dockId: "", date: "", dateEnd: "", isActive: false, reason: "" });
  const [dockDialogOpen, setDockDialogOpen] = useState(false);
  const [editingDock, setEditingDock] = useState<DockWithAvailabilities | null>(null);
  const [dockForm, setDockForm] = useState({ name: "", code: "", sortOrder: 0, active: true });
  const [deleteOverrideId, setDeleteOverrideId] = useState<string | null>(null);

  const { data: docks = [], isLoading: docksLoading } = useQuery({
    queryKey: ["docks"],
    queryFn: docksApi.list,
  });

  const { data: slotTemplates = [] } = useQuery<SlotTemplate[]>({
    queryKey: ["/api/slot-templates"],
    queryFn: () => slotTemplatesApi.list(),
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["dock-overrides"],
    queryFn: () => dockOverridesApi.list(),
  });

  const createDock = useMutation({
    mutationFn: (input: { name: string; code: string; sortOrder?: number; active?: boolean }) => docksApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docks"] });
      setDockDialogOpen(false);
      toast({ title: "Muelle creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateDock = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; code?: string; sortOrder?: number; active?: boolean }) => docksApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docks"] });
      setDockDialogOpen(false);
      setEditingDock(null);
      toast({ title: "Muelle actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ dockId, slotTemplateId, isActive }: { dockId: string; slotTemplateId: string; isActive: boolean }) =>
      docksApi.updateAvailability(dockId, slotTemplateId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docks"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createOverride = useMutation({
    mutationFn: (input: { dockId: string; date: string; dateEnd?: string; isActive?: boolean; reason?: string }) =>
      dockOverridesApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dock-overrides"] });
      setOverrideDialogOpen(false);
      toast({ title: "Excepción de muelle creada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteOverride = useMutation({
    mutationFn: (id: string) => dockOverridesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dock-overrides"] });
      toast({ title: "Excepción eliminada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Group slot templates by day
  const templatesByDay = slotTemplates.reduce<Record<number, SlotTemplate[]>>((acc, t) => {
    if (!acc[t.dayOfWeek]) acc[t.dayOfWeek] = [];
    acc[t.dayOfWeek].push(t);
    return acc;
  }, {});
  Object.values(templatesByDay).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  const sortedDays = Object.keys(templatesByDay).map(Number).sort((a, b) => a - b);

  function getAvailability(dock: DockWithAvailabilities, slotTemplateId: string): boolean {
    const av = dock.availabilities.find(a => a.slotTemplateId === slotTemplateId);
    return av ? av.isActive : true;
  }

  function openCreateDock() {
    setEditingDock(null);
    setDockForm({ name: "", code: "", sortOrder: docks.length, active: true });
    setDockDialogOpen(true);
  }

  function openEditDock(dock: DockWithAvailabilities) {
    setEditingDock(dock);
    setDockForm({ name: dock.name, code: dock.code, sortOrder: dock.sortOrder, active: dock.active });
    setDockDialogOpen(true);
  }

  function handleSaveDock() {
    if (editingDock) {
      updateDock.mutate({ id: editingDock.id, ...dockForm });
    } else {
      createDock.mutate(dockForm);
    }
  }

  if (docksLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-16 rounded skeleton-shimmer" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dock list + create */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Warehouse className="h-5 w-5" />
          Muelles ({docks.length})
        </h3>
        {!isReadOnly && (
          <Button size="sm" onClick={openCreateDock}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo muelle
          </Button>
        )}
      </div>

      {docks.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No hay muelles configurados. Crea el primer muelle para gestionar su disponibilidad por franja.
        </Card>
      ) : (
        <>
          {/* Dock badges */}
          <div className="flex flex-wrap gap-2">
            {docks.map(dock => (
              <button
                key={dock.id}
                onClick={() => !isReadOnly && openEditDock(dock)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  dock.active
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
                } ${!isReadOnly ? "hover:shadow-sm cursor-pointer" : ""}`}
              >
                <span className="font-mono font-semibold">{dock.code}</span>
                <span>{dock.name}</span>
                {dock.active ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </button>
            ))}
          </div>

          {/* Availability Matrix */}
          {slotTemplates.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Primero configura plantillas de franja en la pestaña "Plantillas" para poder asignar muelles.
            </Card>
          ) : (
            <Card className="overflow-x-auto">
              <div className="p-3 border-b bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Marca en qué franjas está disponible cada muelle. <span className="text-green-600 font-medium">Verde = activo</span>, <span className="text-red-600 font-medium">Rojo = inactivo</span>.
                </p>
              </div>
              <ResponsiveTable><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">Muelle</TableHead>
                    {sortedDays.flatMap(day =>
                      templatesByDay[day].map(t => (
                        <TableHead key={t.id} className="text-center text-xs whitespace-nowrap px-2">
                          <div>{DOCK_WEEKDAY_NAMES[day]}</div>
                          <div className="font-mono text-[10px]">{t.startTime}-{t.endTime}</div>
                        </TableHead>
                      ))
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docks.map(dock => (
                    <TableRow key={dock.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium whitespace-nowrap">
                        <Badge variant="outline" className="font-mono mr-1">{dock.code}</Badge>
                        {dock.name}
                      </TableCell>
                      {sortedDays.flatMap(day =>
                        templatesByDay[day].map(t => {
                          const isActive = getAvailability(dock, t.id);
                          return (
                            <TableCell key={t.id} className="text-center px-2">
                              {isReadOnly ? (
                                isActive ? <Check className="h-4 w-4 text-green-600 mx-auto" /> : <X className="h-4 w-4 text-red-500 mx-auto" />
                              ) : (
                                <button
                                  className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                                    isActive
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200"
                                      : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200"
                                  }`}
                                  onClick={() => toggleAvailability.mutate({ dockId: dock.id, slotTemplateId: t.id, isActive: !isActive })}
                                >
                                  {isActive ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </TableCell>
                          );
                        })
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table></ResponsiveTable>
            </Card>
          )}

          {/* Dock Overrides */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Excepciones de Muelles</h3>
              {!isReadOnly && (
                <Button size="sm" onClick={() => {
                  setOverrideForm({ dockId: docks[0]?.id || "", date: "", dateEnd: "", isActive: false, reason: "" });
                  setOverrideDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva excepción
                </Button>
              )}
            </div>
            {overrides.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground text-sm">
                Sin excepciones. Usa excepciones para desactivar o reactivar un muelle en fechas concretas.
              </Card>
            ) : (
              <Card>
                <ResponsiveTable><Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Muelle</TableHead>
                      <TableHead>Desde</TableHead>
                      <TableHead>Hasta</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                      <TableHead>Motivo</TableHead>
                      {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.map((ov: DockOverrideResponse) => {
                      const dock = docks.find(d => d.id === ov.dockId);
                      return (
                        <TableRow key={ov.id}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{dock?.code || "?"}</Badge>
                            {" "}{dock?.name || "Desconocido"}
                          </TableCell>
                          <TableCell>{new Date(ov.date).toLocaleDateString("es-ES")}</TableCell>
                          <TableCell>{ov.dateEnd ? new Date(ov.dateEnd).toLocaleDateString("es-ES") : "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={ov.isActive ? "default" : "destructive"}>
                              {ov.isActive ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{ov.reason || "—"}</TableCell>
                          {!isReadOnly && (
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteOverrideId(ov.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table></ResponsiveTable>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Dock Create/Edit Dialog */}
      <Dialog open={dockDialogOpen} onOpenChange={setDockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDock ? "Editar muelle" : "Nuevo muelle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cap-dock-code">Código</Label>
              <Input id="cap-dock-code" placeholder="M1" value={dockForm.code} onChange={e => setDockForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="cap-dock-name">Nombre</Label>
              <Input id="cap-dock-name" placeholder="Muelle 1" value={dockForm.name} onChange={e => setDockForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="cap-dock-order">Orden</Label>
              <Input id="cap-dock-order" type="number" value={dockForm.sortOrder} onChange={e => setDockForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={dockForm.active} onCheckedChange={active => setDockForm(f => ({ ...f, active }))} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDockDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveDock} disabled={!dockForm.name.trim() || !dockForm.code.trim() || createDock.isPending || updateDock.isPending}>
              {editingDock ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Create Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva excepción de muelle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Muelle</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={overrideForm.dockId}
                onChange={e => setOverrideForm(f => ({ ...f, dockId: e.target.value }))}
              >
                {docks.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde</Label>
                <Input type="date" value={overrideForm.date} onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Hasta (opcional)</Label>
                <Input type="date" value={overrideForm.dateEnd} onChange={e => setOverrideForm(f => ({ ...f, dateEnd: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={overrideForm.isActive} onCheckedChange={isActive => setOverrideForm(f => ({ ...f, isActive }))} />
              <Label>{overrideForm.isActive ? "Reactivar muelle" : "Desactivar muelle"}</Label>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input placeholder="Mantenimiento, avería..." value={overrideForm.reason} onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                createOverride.mutate({
                  dockId: overrideForm.dockId,
                  date: new Date(overrideForm.date + "T00:00:00").toISOString(),
                  dateEnd: overrideForm.dateEnd ? new Date(overrideForm.dateEnd + "T23:59:59").toISOString() : undefined,
                  isActive: overrideForm.isActive,
                  reason: overrideForm.reason || undefined,
                });
              }}
              disabled={!overrideForm.dockId || !overrideForm.date || createOverride.isPending}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Override Confirmation */}
      <ConfirmDialog
        open={!!deleteOverrideId}
        onOpenChange={open => !open && setDeleteOverrideId(null)}
        title="Eliminar excepción"
        description="¿Eliminar esta excepción de muelle?"
        confirmLabel="Eliminar"
        onConfirm={() => { if (deleteOverrideId) deleteOverride.mutate(deleteOverrideId); setDeleteOverrideId(null); }}
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
          <TabsTrigger value="docks" data-testid="tab-docks">
            Muelles
          </TabsTrigger>
          <TabsTrigger value="overrides" data-testid="tab-overrides">
            Excepciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <SlotTemplatesTab isReadOnly={isReadOnly} />
        </TabsContent>

        <TabsContent value="docks" className="mt-4">
          <DockAvailabilityTab isReadOnly={isReadOnly} />
        </TabsContent>

        <TabsContent value="overrides" className="mt-4">
          <SlotOverridesTab isReadOnly={isReadOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
