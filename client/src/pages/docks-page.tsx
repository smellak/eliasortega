import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ResponsiveTable } from "@/components/responsive-table";
import { docksApi, dockOverridesApi, slotTemplatesApi } from "@/lib/api";
import type { DockWithAvailabilities, DockTimelineEntry, DockOverrideResponse } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Warehouse, Plus, Trash2, Pencil, Check, X, Clock, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TableSkeleton } from "@/components/skeleton-loaders";
import { EmptyState } from "@/components/empty-state";
import { formatInTimeZone } from "date-fns-tz";
import { DockMap } from "@/components/dock-map";

interface DocksPageProps {
  userRole: "ADMIN" | "PLANNER" | "BASIC_READONLY";
}

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function DocksPage({ userRole }: DocksPageProps) {
  const { toast } = useToast();
  const isReadOnly = userRole === "BASIC_READONLY";

  // --- State ---
  const [dockDialogOpen, setDockDialogOpen] = useState(false);
  const [editingDock, setEditingDock] = useState<DockWithAvailabilities | null>(null);
  const [dockForm, setDockForm] = useState({ name: "", code: "", sortOrder: 0, active: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ dockId: "", date: "", dateEnd: "", isActive: false, reason: "" });
  const [timelineDate, setTimelineDate] = useState(() => {
    return formatInTimeZone(new Date(), "Europe/Madrid", "yyyy-MM-dd");
  });

  // --- Queries ---
  const { data: docks = [], isLoading: docksLoading } = useQuery({
    queryKey: ["docks"],
    queryFn: docksApi.list,
  });

  const { data: slotTemplates = [] } = useQuery({
    queryKey: ["slot-templates"],
    queryFn: slotTemplatesApi.list,
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["dock-overrides"],
    queryFn: () => dockOverridesApi.list(),
  });

  const { data: timeline } = useQuery({
    queryKey: ["dock-timeline", timelineDate],
    queryFn: () => docksApi.getTimeline(timelineDate),
  });

  // --- Mutations ---
  const createDock = useMutation({
    mutationFn: (input: { name: string; code: string; sortOrder?: number; active?: boolean }) =>
      docksApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docks"] });
      setDockDialogOpen(false);
      toast({ title: "Muelle creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateDock = useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; code?: string; sortOrder?: number; active?: boolean }) =>
      docksApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docks"] });
      setDockDialogOpen(false);
      setEditingDock(null);
      toast({ title: "Muelle actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDock = useMutation({
    mutationFn: (id: string) => docksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docks"] });
      setDeleteId(null);
      toast({ title: "Muelle eliminado" });
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
      toast({ title: "Excepción creada" });
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

  // --- Handlers ---
  function openCreate() {
    setEditingDock(null);
    setDockForm({ name: "", code: "", sortOrder: docks.length, active: true });
    setDockDialogOpen(true);
  }

  function openEdit(dock: DockWithAvailabilities) {
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

  // Group slot templates by day
  const templatesByDay = slotTemplates.reduce<Record<number, typeof slotTemplates>>((acc, t) => {
    if (!acc[t.dayOfWeek]) acc[t.dayOfWeek] = [];
    acc[t.dayOfWeek].push(t);
    return acc;
  }, {});

  // Sort templates within each day
  Object.values(templatesByDay).forEach(arr => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));

  // Unique sorted days
  const sortedDays = Object.keys(templatesByDay).map(Number).sort((a, b) => a - b);

  function getAvailability(dock: DockWithAvailabilities, slotTemplateId: string): boolean {
    const av = dock.availabilities.find(a => a.slotTemplateId === slotTemplateId);
    return av ? av.isActive : true; // default active if no record
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <Warehouse className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Muelles de descarga</h1>
            <p className="text-sm text-muted-foreground">Gestión de muelles, disponibilidad y excepciones</p>
          </div>
        </div>
        {!isReadOnly && (
          <Button onClick={openCreate} className="gradient-btn text-white border-0">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo muelle
          </Button>
        )}
      </div>

      <DockMap />

      <Tabs defaultValue="docks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="docks">Muelles</TabsTrigger>
          <TabsTrigger value="availability">Disponibilidad</TabsTrigger>
          <TabsTrigger value="overrides">Excepciones</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* ===== TAB: Muelles CRUD ===== */}
        <TabsContent value="docks">
          <Card className="p-0 overflow-hidden">
            {docksLoading ? (
              <TableSkeleton rows={3} cols={5} />
            ) : docks.length === 0 ? (
              <EmptyState icon={Warehouse} title="No hay muelles configurados" description="Añade un muelle para empezar." />
            ) : (
              <ResponsiveTable><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-center">Orden</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docks.map(dock => (
                    <TableRow key={dock.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{dock.code}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{dock.name}</TableCell>
                      <TableCell className="text-center">{dock.sortOrder}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={dock.active ? "default" : "secondary"}>
                          {dock.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(dock)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(dock.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table></ResponsiveTable>
            )}
          </Card>
        </TabsContent>

        {/* ===== TAB: Matriz Disponibilidad ===== */}
        <TabsContent value="availability">
          <Card className="p-4 overflow-x-auto">
            <p className="text-sm text-muted-foreground mb-4">
              Marca en qué franjas horarias está disponible cada muelle. Verde = activo, rojo = inactivo.
            </p>
            {docks.length === 0 || slotTemplates.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Necesitas al menos un muelle y una franja para configurar disponibilidad.
              </div>
            ) : (
              <ResponsiveTable><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[100px]">Muelle</TableHead>
                    {sortedDays.flatMap(day =>
                      templatesByDay[day].map(t => (
                        <TableHead key={t.id} className="text-center text-xs whitespace-nowrap px-2">
                          <div>{WEEKDAY_NAMES[day]}</div>
                          <div className="font-mono text-[10px]">{t.startTime}-{t.endTime}</div>
                        </TableHead>
                      ))
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docks.map(dock => (
                    <TableRow key={dock.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <Badge variant="outline" className="font-mono mr-1">{dock.code}</Badge>
                        {dock.name}
                      </TableCell>
                      {sortedDays.flatMap(day =>
                        templatesByDay[day].map(t => {
                          const isActive = getAvailability(dock, t.id);
                          return (
                            <TableCell key={t.id} className="text-center px-2">
                              {isReadOnly ? (
                                isActive ? (
                                  <Check className="h-4 w-4 text-green-600 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-red-500 mx-auto" />
                                )
                              ) : (
                                <button
                                  className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                                    isActive
                                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200"
                                      : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200"
                                  }`}
                                  onClick={() =>
                                    toggleAvailability.mutate({ dockId: dock.id, slotTemplateId: t.id, isActive: !isActive })
                                  }
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
            )}
          </Card>
        </TabsContent>

        {/* ===== TAB: Excepciones de muelles ===== */}
        <TabsContent value="overrides">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b">
              <p className="text-sm text-muted-foreground">
                Excepciones que desactivan o reactivan un muelle en fechas concretas.
              </p>
              {!isReadOnly && (
                <Button
                  size="sm"
                  onClick={() => {
                    setOverrideForm({ dockId: docks[0]?.id || "", date: "", dateEnd: "", isActive: false, reason: "" });
                    setOverrideDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nueva excepción
                </Button>
              )}
            </div>
            {overrides.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No hay excepciones configuradas</div>
            ) : (
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
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteOverride.mutate(ov.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table></ResponsiveTable>
            )}
          </Card>
        </TabsContent>

        {/* ===== TAB: Timeline ===== */}
        <TabsContent value="timeline">
          <Card className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Label htmlFor="timeline-date">Fecha:</Label>
              <Input
                id="timeline-date"
                type="date"
                className="w-48"
                value={timelineDate}
                onChange={e => setTimelineDate(e.target.value)}
              />
            </div>

            {!timeline?.docks || timeline.docks.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Sin datos de timeline para esta fecha.
              </div>
            ) : (
              <div className="space-y-3">
                {timeline.docks.map((d: DockTimelineEntry) => (
                  <div key={d.dockId} className="rounded-lg border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="font-mono">{d.dockCode}</Badge>
                      <span className="font-medium">{d.dockName}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {d.appointments.length} cita{d.appointments.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    {d.appointments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin citas asignadas</p>
                    ) : (
                      <div className="space-y-1.5">
                        {d.appointments.map(appt => {
                          const start = new Date(appt.startUtc).toLocaleTimeString("es-ES", {
                            timeZone: "Europe/Madrid",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          const end = new Date(appt.endUtc).toLocaleTimeString("es-ES", {
                            timeZone: "Europe/Madrid",
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                          return (
                            <div
                              key={appt.id}
                              className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 ${
                                appt.confirmationStatus === "cancelled"
                                  ? "bg-red-50 dark:bg-red-950/20 line-through opacity-60"
                                  : appt.confirmationStatus === "confirmed"
                                  ? "bg-green-50 dark:bg-green-950/20"
                                  : "bg-muted/50"
                              }`}
                            >
                              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-mono text-xs">{start}–{end}</span>
                              <span className="font-medium">{appt.providerName}</span>
                              {appt.goodsType && <span className="text-muted-foreground">({appt.goodsType})</span>}
                              {appt.size && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {appt.size}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Dock Create/Edit Dialog ===== */}
      <Dialog open={dockDialogOpen} onOpenChange={setDockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDock ? "Editar muelle" : "Nuevo muelle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="dock-code">Código</Label>
              <Input
                id="dock-code"
                placeholder="M1"
                value={dockForm.code}
                onChange={e => setDockForm(f => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dock-name">Nombre</Label>
              <Input
                id="dock-name"
                placeholder="Muelle 1"
                value={dockForm.name}
                onChange={e => setDockForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="dock-order">Orden</Label>
              <Input
                id="dock-order"
                type="number"
                value={dockForm.sortOrder}
                onChange={e => setDockForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={dockForm.active}
                onCheckedChange={active => setDockForm(f => ({ ...f, active }))}
              />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDockDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveDock}
              disabled={!dockForm.name.trim() || !dockForm.code.trim() || createDock.isPending || updateDock.isPending}
            >
              {editingDock ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Override Create Dialog ===== */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva excepción de muelle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ov-dock">Muelle</Label>
              <select
                id="ov-dock"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={overrideForm.dockId}
                onChange={e => setOverrideForm(f => ({ ...f, dockId: e.target.value }))}
              >
                {docks.map(d => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ov-date">Desde</Label>
                <Input
                  id="ov-date"
                  type="date"
                  value={overrideForm.date}
                  onChange={e => setOverrideForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="ov-date-end">Hasta (opcional)</Label>
                <Input
                  id="ov-date-end"
                  type="date"
                  value={overrideForm.dateEnd}
                  onChange={e => setOverrideForm(f => ({ ...f, dateEnd: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={overrideForm.isActive}
                onCheckedChange={isActive => setOverrideForm(f => ({ ...f, isActive }))}
              />
              <Label>{overrideForm.isActive ? "Reactivar muelle en esa fecha" : "Desactivar muelle en esa fecha"}</Label>
            </div>
            <div>
              <Label htmlFor="ov-reason">Motivo (opcional)</Label>
              <Input
                id="ov-reason"
                placeholder="Mantenimiento, avería..."
                value={overrideForm.reason}
                onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
              />
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

      {/* ===== Delete Confirmation ===== */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => !open && setDeleteId(null)}
        title="Eliminar muelle"
        description="¿Estás seguro de que quieres eliminar este muelle? Las citas asignadas a este muelle perderán su asignación."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => deleteId && deleteDock.mutate(deleteId)}
      />
    </div>
  );
}
